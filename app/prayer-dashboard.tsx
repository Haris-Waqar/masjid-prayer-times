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
import {
  PRAYER_URDU,
  publicCopy,
  remainingCopy,
  updatedCopy,
  type BilingualText,
} from "@/lib/ui-copy";

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
  const [statusMessage, setStatusMessage] = useState<BilingualText | null>(null);
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
      setStatusMessage(publicCopy.jamaatChanged);
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

    const dismissTimer = window.setTimeout(() => setStatusMessage(null), 5_000);
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
      setStatusMessage(publicCopy.alertsAfterPostingToast);
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setAlertState("unsupported");
      setStatusMessage(publicCopy.pushUnsupported);
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
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.toJSON().keys?.p256dh,
            auth: subscription.toJSON().keys?.auth,
          },
          locale: navigator.language.toLowerCase().startsWith("ur") ? "ur" : "en",
        }),
      });
      if (!response.ok) throw new Error("This device could not be registered.");
      setAlertState("enabled");
      setStatusMessage(publicCopy.alertsEnabled);
    } catch (error) {
      setAlertState("error");
      setStatusMessage(
        error instanceof Error
          ? { en: error.message, ur: publicCopy.alertsEnableFailed.ur }
          : publicCopy.alertsEnableFailed,
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
      setStatusMessage(publicCopy.alertsDisabled);
    } catch (error) {
      setAlertState("enabled");
      setStatusMessage(
        error instanceof Error
          ? { en: error.message, ur: publicCopy.alertsDisableFailed.ur }
          : publicCopy.alertsDisableFailed,
      );
    } finally {
      setIsDisablingAlerts(false);
    }
  }

  async function refreshTimetable() {
    setIsManualRefreshing(true);
    setStatusMessage(publicCopy.refreshing);
    try {
      const response = await fetch(`/?refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Refresh failed");
      startRefresh(() => router.refresh());
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      setStatusMessage(publicCopy.refreshed);
    } catch {
      setStatusMessage(publicCopy.refreshFailed);
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
    setStatusMessage(publicCopy.installHint);
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
                <p id="next-prayer-heading">
                  {publicCopy.nextJamaat.en}
                  <span className="action-urdu" lang="ur">
                    {publicCopy.nextJamaat.ur}
                  </span>
                </p>
                <h1>{nextPrayer.prayer}</h1>
                <p className="urdu prayer-urdu" lang="ur" dir="rtl">
                  {PRAYER_URDU[nextPrayer.prayer]}
                </p>
                <time dateTime={nextPrayer.jamaat}>
                  {displayTime(nextPrayer.jamaat)}
                </time>
                <p className="countdown" aria-live="polite">
                  <span>
                    {now
                      ? remainingCopy(
                          Math.floor(remaining / 60),
                          remaining % 60,
                          nextIsTomorrow,
                        ).en
                      : publicCopy.calculating.en}
                  </span>
                  <span className="countdown-urdu" lang="ur" dir="rtl">
                    {now
                      ? remainingCopy(
                          Math.floor(remaining / 60),
                          remaining % 60,
                          nextIsTomorrow,
                        ).ur
                      : publicCopy.calculating.ur}
                  </span>
                </p>
              </>
            ) : (
              <>
                <p id="next-prayer-heading">
                  {publicCopy.todaysTimes.en}
                  <span className="action-urdu" lang="ur">
                    {publicCopy.todaysTimes.ur}
                  </span>
                </p>
                <h1 className="awaiting-title">{publicCopy.timesNotPosted.en}</h1>
                <p className="countdown">
                  <span>{publicCopy.timesNotPostedDetail.en}</span>
                  <span className="action-urdu" lang="ur">
                    {publicCopy.timesNotPostedDetail.ur}
                  </span>
                </p>
              </>
            )}
          </div>
          {showDisableAlerts ? (
            <button
              className="notify-disable"
              type="button"
              onClick={disableNotifications}
              disabled={isDisablingAlerts}
              aria-label={
                isDisablingAlerts ? publicCopy.disablingAlerts.en : publicCopy.disableAlerts.en
              }
              title={publicCopy.disableAlerts.en}
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
              <ActionLabel
                text={
                  !schedulePublished
                    ? publicCopy.alertsAfterPosting
                    : alertState === "checking"
                      ? publicCopy.checkingAlerts
                      : alertState === "working"
                        ? publicCopy.enablingAlerts
                        : alertState === "blocked"
                          ? publicCopy.alertsBlocked
                          : alertState === "unsupported"
                            ? publicCopy.alertsUnavailable
                            : publicCopy.notify
                }
              />
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
              <h2 id="schedule-heading">
                {publicCopy.todaysTimes.en}
                <span className="heading-urdu" lang="ur">
                  {publicCopy.todaysTimes.ur}
                </span>
              </h2>
            </div>
            <button
              className="refresh-button"
              type="button"
              onClick={refreshTimetable}
              disabled={isRefreshing}
              aria-label={isRefreshing ? publicCopy.refreshingTimes.en : publicCopy.refreshTimes.en}
              title={publicCopy.refreshTimes.en}
            >
              <RefreshCw className={isRefreshing ? "is-spinning" : undefined} size={20} />
            </button>
          </div>

          <div className="schedule-head" aria-hidden="true">
            <span>{publicCopy.prayer.en}</span>
            <span>{publicCopy.jamaat.en}</span>
          </div>
          <ol className="schedule-list">
            {times.map((item, index) => (
              <li
                key={item.prayer}
                className={schedulePublished && index === nextIndex ? "is-next" : undefined}
              >
                <span className="prayer-name">
                  <span>{item.prayer}</span>
                  <span className="urdu" lang="ur" dir="rtl">
                    {PRAYER_URDU[item.prayer]}
                  </span>
                  {schedulePublished && index === nextIndex && (
                    <small>{publicCopy.nextBadge.en}</small>
                  )}
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
              {updatedCopy(
                new Intl.DateTimeFormat("en", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: settings.timezone,
                }).format(new Date(settings.updatedAt)),
              ).en}
            </p>
          ) : (
            <p className="unpublished-note">{publicCopy.unposted.en}</p>
          )}
        </section>

        {!isAppInstalled && (
          <aside className="utility-panel" aria-label={publicCopy.appOptions.en}>
            <div className="utility-copy">
              <Share2 size={22} aria-hidden="true" />
              <div>
                <h2>{publicCopy.keepHandy.en}</h2>
                <p className="action-urdu" lang="ur">
                  {publicCopy.keepHandy.ur}
                </p>
              </div>
            </div>
            <button className="secondary-button" type="button" onClick={installApp}>
              <ActionLabel text={publicCopy.installApp} />
            </button>
            <div className="offline-note">
              <WifiOff size={17} aria-hidden="true" />
              <span>
                {publicCopy.offline.en}
                <span className="action-urdu" lang="ur">
                  {publicCopy.offline.ur}
                </span>
              </span>
            </div>
          </aside>
        )}
      </div>

      {statusMessage && (
        <output className="status-toast" aria-live="polite">
          {statusMessage.en}
          <button onClick={() => setStatusMessage(null)} aria-label={publicCopy.dismiss.en}>
            ×
          </button>
        </output>
      )}

      <footer>
        <p>{publicCopy.footer.en}</p>
      </footer>
    </main>
  );
}

function ActionLabel({ text }: { text: BilingualText }) {
  return (
    <span className="action-label">
      <span>{text.en}</span>
      <span className="action-urdu" lang="ur">
        {text.ur}
      </span>
    </span>
  );
}
