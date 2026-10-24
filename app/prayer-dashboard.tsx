"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  BellRing,
  CalendarDays,
  MapPin,
  RefreshCw,
  Share2,
  WifiOff,
} from "lucide-react";
import { NavigationPendingIcon } from "@/app/navigation-pending-icon";
import type { MosqueSettings, PrayerTime } from "@/lib/prayers";

type Props = {
  settings: MosqueSettings;
  date: string;
  times: PrayerTime[];
  schedulePublished: boolean;
};

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function displayTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2020, 0, 1, hours, minutes)));
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) =>
    character.charCodeAt(0),
  );
}

export function PrayerDashboard({
  settings,
  date,
  times,
  schedulePublished,
}: Props) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [alertState, setAlertState] = useState<
    "checking" | "idle" | "working" | "enabled" | "unsupported" | "blocked" | "error"
  >("checking");
  const [isDisablingAlerts, setIsDisablingAlerts] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isRouteRefreshing, startRefresh] = useTransition();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const isRefreshing = isRouteRefreshing || isManualRefreshing;
  const showDisableAlerts = alertState === "enabled" || isDisablingAlerts;

  useEffect(() => {
    const installedQuery = window.matchMedia(
      "(display-mode: standalone), (display-mode: window-controls-overlay)",
    );
    const syncInstalledState = () => {
      const iosStandalone =
        "standalone" in navigator &&
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setIsAppInstalled(installedQuery.matches || iosStandalone);
    };
    syncInstalledState();
    installedQuery.addEventListener("change", syncInstalledState);

    const initialTimer = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    const receiveServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== "TIMETABLE_UPDATED") return;
      setStatusMessage("A prayer time changed. The timetable has been refreshed.");
      startRefresh(() => router.refresh());
    };

    let cancelled = false;
    async function prepareNotifications() {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setAlertState("unsupported");
        return;
      }
      try {
        navigator.serviceWorker.addEventListener("message", receiveServiceWorkerMessage);
        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.getSubscription();
        if (cancelled) return;
        if (Notification.permission === "denied") {
          setAlertState("blocked");
        } else if (subscription && Notification.permission === "granted") {
          setAlertState("enabled");
        } else {
          setAlertState("idle");
        }
      } catch {
        if (!cancelled) setAlertState("error");
      }
    }
    void prepareNotifications();

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      installedQuery.removeEventListener("change", syncInstalledState);
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", receiveServiceWorkerMessage);
      }
    };
  }, [router]);

  useEffect(() => {
    if (!statusMessage) return;

    const dismissTimer = window.setTimeout(() => setStatusMessage(""), 5_000);
    return () => window.clearTimeout(dismissTimer);
  }, [statusMessage]);

  const currentMinutes = useMemo(() => {
    if (!now) return 0;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: settings.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const hours = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
    const minutes = Number(
      parts.find((part) => part.type === "minute")?.value ?? 0,
    );
    return hours * 60 + minutes;
  }, [now, settings.timezone]);

  const nextIndex = useMemo(() => {
    const index = times.findIndex((item) => toMinutes(item.jamaat) > currentMinutes);
    return index === -1 ? 0 : index;
  }, [currentMinutes, times]);

  const nextPrayer = times[nextIndex];
  const nextIsTomorrow = times.every(
    (item) => toMinutes(item.jamaat) <= currentMinutes,
  );
  const remaining = Math.max(
    0,
    toMinutes(nextPrayer.jamaat) + (nextIsTomorrow ? 24 * 60 : 0) - currentMinutes,
  );

  async function enableNotifications() {
    if (!schedulePublished) {
      setStatusMessage("Alerts will be available after the imam publishes the timetable.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setAlertState("unsupported");
      setStatusMessage("This browser does not support web push notifications.");
      return;
    }

    setAlertState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission was not granted.");
      }
      const configResponse = await fetch("/api/push/config");
      const config = (await configResponse.json()) as { publicKey?: string };
      if (!config.publicKey) {
        throw new Error("Notifications are awaiting final mosque setup.");
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        }));
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!response.ok) throw new Error("This device could not be registered.");
      setAlertState("enabled");
      setStatusMessage("Alerts are enabled on this device.");
    } catch (error) {
      setAlertState("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Notifications could not be enabled.",
      );
    }
  }

  async function disableNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setAlertState("unsupported");
      return;
    }

    setIsDisablingAlerts(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("Alerts could not be disabled on this device.");
        const unsubscribed = await subscription.unsubscribe();
        if (!unsubscribed) throw new Error("Alerts could not be disabled on this device.");
      }
      setAlertState("idle");
      setStatusMessage("Alerts are disabled on this device.");
    } catch (error) {
      setAlertState("enabled");
      setStatusMessage(
        error instanceof Error ? error.message : "Alerts could not be disabled.",
      );
    } finally {
      setIsDisablingAlerts(false);
    }
  }

  async function refreshTimetable() {
    setIsManualRefreshing(true);
    setStatusMessage("Refreshing timetable…");
    try {
      const response = await fetch(`/?refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Refresh failed");
      startRefresh(() => router.refresh());
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      setStatusMessage("Timetable refreshed.");
    } catch {
      setStatusMessage("The timetable could not be refreshed. Please try again.");
    } finally {
      setIsManualRefreshing(false);
    }
  }

  async function installApp() {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }
    setStatusMessage(
      "On iPhone, use Share → Add to Home Screen. On Android, open the browser menu and choose Install app.",
    );
  }

  const formattedDate = new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

  return (
    <main className="app-shell">
      <header className="site-header">
        <img
          className="brand-mark"
          src="/favicon.svg"
          alt=""
          width={46}
          height={46}
          aria-hidden="true"
        />
        <div className="brand-copy">
          <p className="brand-name">{settings.name}</p>
          <p className="brand-location">
            <MapPin size={14} aria-hidden="true" /> {settings.location}
          </p>
        </div>
        <Link
          className="icon-button"
          href="/admin"
          aria-label="Open admin area"
        >
          <NavigationPendingIcon kind="admin" size={21} />
        </Link>
      </header>

      <div className="page-grid">
        <section className="next-prayer-panel" aria-labelledby="next-prayer-heading">
          <div className="arch-line" aria-hidden="true">
            <svg
              className="musalla-niche"
              viewBox="0 0 100 160"
              preserveAspectRatio="none"
            >
              <defs>
                <pattern
                  id="musalla-weave"
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(-18)"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="6"
                    stroke="#d1a95f"
                    strokeOpacity="0.14"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                </pattern>
              </defs>
              <path
                d="M 4 156 V 70 C 4 47 20 30 39 18 C 46 14 50 8 50 2 C 50 8 54 14 61 18 C 80 30 96 47 96 70 V 156 Z"
                fill="url(#musalla-weave)"
                stroke="#d1a95f"
                strokeOpacity="0.44"
                strokeWidth="1"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
          <p className="today-line">
            <CalendarDays size={17} aria-hidden="true" /> {formattedDate}
          </p>
          <div className="next-prayer-copy">
            {schedulePublished ? (
              <>
                <p id="next-prayer-heading">Next jamaat</p>
                <h1>{nextPrayer.prayer}</h1>
                <time dateTime={nextPrayer.jamaat}>
                  {displayTime(nextPrayer.jamaat)}
                </time>
                <p className="countdown" aria-live="polite">
                  {now
                    ? `${Math.floor(remaining / 60)}h ${remaining % 60}m remaining${
                        nextIsTomorrow ? " · tomorrow" : ""
                      }`
                    : "Calculating…"}
                </p>
              </>
            ) : (
              <>
                <p id="next-prayer-heading">Today&apos;s jamaat times</p>
                <h1 className="awaiting-title">Awaiting confirmation</h1>
                <p className="countdown">The imam has not published today&apos;s timetable.</p>
              </>
            )}
          </div>
          {showDisableAlerts ? (
            <button
              className="notify-disable"
              type="button"
              onClick={disableNotifications}
              disabled={isDisablingAlerts}
              aria-label={isDisablingAlerts ? "Disabling alerts" : "Disable alerts"}
              title="Disable alerts"
            >
              {isDisablingAlerts ? (
                <BellRing className="is-spinning" size={20} aria-hidden="true" />
              ) : (
                <BellOff size={20} aria-hidden="true" />
              )}
            </button>
          ) : (
            <button
              className="notify-button"
              type="button"
              onClick={enableNotifications}
              disabled={
                !schedulePublished ||
                alertState === "checking" ||
                alertState === "working" ||
                alertState === "unsupported" ||
                alertState === "blocked"
              }
            >
              {alertState === "working" || alertState === "checking" ? (
                <BellRing className="is-spinning" size={19} />
              ) : (
                <Bell size={19} />
              )}
              {!schedulePublished
                ? "Alerts available after publishing"
                : alertState === "checking"
                  ? "Checking alerts…"
                  : alertState === "working"
                    ? "Enabling…"
                    : alertState === "blocked"
                      ? "Alerts blocked"
                      : alertState === "unsupported"
                        ? "Alerts unavailable"
                        : "Alert me to changes"}
            </button>
          )}
        </section>

        <section
          className="schedule-panel"
          aria-labelledby="schedule-heading"
          aria-busy={isRefreshing}
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">Today</p>
              <h2 id="schedule-heading">Prayer timetable</h2>
            </div>
            <button
              className="refresh-button"
              type="button"
              onClick={refreshTimetable}
              disabled={isRefreshing}
              aria-label={isRefreshing ? "Refreshing timetable" : "Refresh timetable"}
              title="Refresh timetable"
            >
              <RefreshCw className={isRefreshing ? "is-spinning" : undefined} size={20} />
            </button>
          </div>

          <div className="schedule-head" aria-hidden="true">
            <span>Prayer</span>
            <span>Jamaat</span>
          </div>
          <ol className="schedule-list">
            {times.map((item, index) => (
              <li
                key={item.prayer}
                className={schedulePublished && index === nextIndex ? "is-next" : undefined}
              >
                <span className="prayer-name">
                  {item.prayer}
                  {schedulePublished && index === nextIndex && <small>Next</small>}
                </span>
                {schedulePublished ? (
                  <time dateTime={item.jamaat}>{displayTime(item.jamaat)}</time>
                ) : (
                  <span className="unpublished-time">—</span>
                )}
              </li>
            ))}
          </ol>
          {schedulePublished ? (
            <p className="updated-note">
              Updated {new Intl.DateTimeFormat("en", {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
                timeZone: settings.timezone,
              }).format(new Date(settings.updatedAt))}
            </p>
          ) : (
            <p className="unpublished-note">No unconfirmed times are shown.</p>
          )}
        </section>

        {!isAppInstalled && (
          <aside className="utility-panel" aria-label="App options">
            <div className="utility-copy">
              <Share2 size={22} aria-hidden="true" />
              <div>
                <h2>Keep the timetable close</h2>
                <p>Install this app for fast access, even with a weak connection.</p>
              </div>
            </div>
            <button className="secondary-button" type="button" onClick={installApp}>
              Install this app
            </button>
            <div className="offline-note">
              <WifiOff size={17} aria-hidden="true" />
              The latest timetable remains available offline.
            </div>
          </aside>
        )}
      </div>

      {statusMessage && (
        <output className="status-toast" aria-live="polite">
          {statusMessage}
          <button onClick={() => setStatusMessage("")} aria-label="Dismiss message">
            ×
          </button>
        </output>
      )}

      <footer>
        <p>Always check the effective date when a prayer time changes.</p>
      </footer>
    </main>
  );
}
