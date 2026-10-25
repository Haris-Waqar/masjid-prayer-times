"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellOff, BellRing, Clock, RefreshCw } from "lucide-react";
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

function splitTime(value: string) {
  const formatted = displayTime(value);
  const match = formatted.match(/^(.*?)\s*(AM|PM)$/i);
  return match
    ? { value: match[1], suffix: match[2].toUpperCase() }
    : { value: formatted, suffix: "" };
}

const DIAMONDS = Array.from({ length: 13 });
const TASSELS = Array.from({ length: 28 });

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

  function handleBellClick() {
    if (alertState === "blocked") {
      setStatusMessage(publicCopy.alertsBlocked);
      return;
    }
    if (showDisableAlerts) {
      void disableNotifications();
      return;
    }
    void enableNotifications();
  }

  const bellBusy = alertState === "checking" || alertState === "working" || isDisablingAlerts;
  const bellDisabled = bellBusy || alertState === "unsupported";
  const bellLabel = !schedulePublished
    ? publicCopy.alertsAfterPosting.en
    : alertState === "blocked"
      ? publicCopy.alertsBlocked.en
      : alertState === "unsupported"
        ? publicCopy.alertsUnavailable.en
        : showDisableAlerts
          ? publicCopy.disableAlerts.en
          : publicCopy.notify.en;

  const formattedDate = new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

  const nextTime = schedulePublished ? splitTime(nextPrayer.jamaat) : null;

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
            {settings.location} · {formattedDate}
          </p>
        </div>
        <button
          type="button"
          className="bell-button"
          data-state={
            showDisableAlerts ? "on" : alertState === "blocked" ? "blocked" : "off"
          }
          onClick={handleBellClick}
          disabled={bellDisabled}
          aria-pressed={alertState === "enabled"}
          aria-label={bellLabel}
          title={bellLabel}
        >
          {bellBusy ? (
            <BellRing className="is-spinning" size={20} aria-hidden="true" />
          ) : alertState === "blocked" ? (
            <BellOff size={20} aria-hidden="true" />
          ) : showDisableAlerts ? (
            <BellRing size={20} aria-hidden="true" />
          ) : (
            <Bell size={20} aria-hidden="true" />
          )}
        </button>
      </header>

      {alertState === "blocked" && (
        <p className="alert-banner" role="status">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" />
            <path d="M12 16h.01" />
          </svg>
          <span>
            Notifications are blocked. Allow them in your browser&apos;s site
            settings to get jamaat reminders.
          </span>
        </p>
      )}

      <div className="page-grid">
        <div className="next-prayer-wrap">
          <section
            className="next-prayer-panel"
            aria-labelledby="next-prayer-heading"
          >
            <div className="mihrab-arc" aria-hidden="true" />
            <div className="mihrab-arc mihrab-arc-inner" aria-hidden="true" />
            <div className="next-prayer-copy">
              {schedulePublished && nextTime ? (
                <>
                  <svg
                    className="minaret"
                    width="22"
                    height="34"
                    viewBox="0 0 22 34"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M11 0v6" />
                    <path d="M6 10h10l-1-4H7z" />
                    <path d="M5 10c0 8 2 14 6 16 4-2 6-8 6-16" />
                    <path d="M11 26v4" />
                    <circle cx="11" cy="17" r="2" />
                  </svg>
                  <p id="next-prayer-heading" className="next-kicker">
                    <span>{publicCopy.nextJamaat.en}</span>
                    <span className="kicker-urdu" lang="ur" dir="rtl">
                      {publicCopy.nextJamaat.ur}
                    </span>
                  </p>
                  <p className="next-name">
                    <span>{nextPrayer.prayer}</span>
                    <span className="name-diamond" aria-hidden="true" />
                    <span className="name-urdu" lang="ur" dir="rtl">
                      {PRAYER_URDU[nextPrayer.prayer]}
                    </span>
                  </p>
                  <time className="next-time" dateTime={nextPrayer.jamaat}>
                    {nextTime.value}
                    {nextTime.suffix && (
                      <span className="next-suffix">{nextTime.suffix}</span>
                    )}
                  </time>
                  <p className="countdown" aria-live="polite">
                    <Clock size={16} aria-hidden="true" />
                    <span>
                      {now
                        ? remainingCopy(
                            Math.floor(remaining / 60),
                            remaining % 60,
                            nextIsTomorrow,
                          ).en
                        : publicCopy.calculating.en}
                    </span>
                  </p>
                  <div className="diamond-row" aria-hidden="true">
                    {DIAMONDS.map((_, index) => (
                      <span key={index} />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p id="next-prayer-heading" className="next-kicker">
                    <span>{publicCopy.todaysTimes.en}</span>
                    <span className="kicker-urdu" lang="ur" dir="rtl">
                      {publicCopy.todaysTimes.ur}
                    </span>
                  </p>
                  <h1 className="awaiting-title">{publicCopy.timesNotPosted.en}</h1>
                  <p className="awaiting-detail">
                    <span>{publicCopy.timesNotPostedDetail.en}</span>
                    <span className="name-urdu" lang="ur" dir="rtl">
                      {publicCopy.timesNotPostedDetail.ur}
                    </span>
                  </p>
                </>
              )}
            </div>
          </section>
          <div className="mihrab-tassels" aria-hidden="true">
            {TASSELS.map((_, index) => (
              <span key={index} />
            ))}
          </div>
        </div>

        <section
          className="schedule-panel"
          aria-labelledby="schedule-heading"
          aria-busy={isRefreshing}
        >
          <div className="section-heading">
            <div>
              <h2 id="schedule-heading">{publicCopy.todaysTimes.en}</h2>
              <span className="heading-urdu" lang="ur" dir="rtl">
                {publicCopy.todaysTimes.ur}
              </span>
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

          <ol className="schedule-list">
            {times.map((item, index) => {
              const isNext = schedulePublished && index === nextIndex;
              return (
                <li key={item.prayer} className={isNext ? "is-next" : undefined}>
                  <span className="prayer-name">
                    <svg
                      className="row-arch"
                      width="14"
                      height="18"
                      viewBox="0 0 14 18"
                      fill="none"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    >
                      <path d="M1 17V8a6 6 0 0 1 12 0v9z" />
                    </svg>
                    <span>{item.prayer}</span>
                    <span className="urdu" lang="ur" dir="rtl">
                      {PRAYER_URDU[item.prayer]}
                    </span>
                  </span>
                  {schedulePublished ? (
                    <time dateTime={item.jamaat}>{displayTime(item.jamaat)}</time>
                  ) : (
                    <span className="unpublished-time">—</span>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="schedule-foot">
            {schedulePublished ? (
              <span className="updated-note">
                {updatedCopy(
                  new Intl.DateTimeFormat("en", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: settings.timezone,
                  }).format(new Date(settings.updatedAt)),
                ).en}
              </span>
            ) : (
              <span className="unpublished-note">{publicCopy.unposted.en}</span>
            )}
            <Link className="update-link" href="/admin">
              <NavigationPendingIcon kind="admin" size={15} />
              <span>Update times</span>
            </Link>
          </div>
        </section>

        {!isAppInstalled && (
          <aside className="utility-panel" aria-label={publicCopy.appOptions.en}>
            <div className="utility-copy">
              <h2>{publicCopy.keepHandy.en}</h2>
              <p>{publicCopy.offline.en}</p>
            </div>
            <button className="secondary-button" type="button" onClick={installApp}>
              {publicCopy.installApp.en}
            </button>
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
