"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BellRing,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Settings2,
  Share2,
  WifiOff,
} from "lucide-react";
import type { MosqueSettings, PrayerTime } from "@/lib/prayers";

type Props = {
  settings: MosqueSettings;
  date: string;
  times: PrayerTime[];
  isAdmin: boolean;
  adminHref: string;
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
  isAdmin,
  adminHref,
}: Props) {
  const [now, setNow] = useState<Date | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [alertState, setAlertState] = useState<
    "idle" | "working" | "enabled" | "unsupported" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
    };
  }, []);

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
        <div className="brand-mark" aria-hidden="true">
          <span />
        </div>
        <div className="brand-copy">
          <p className="brand-name">{settings.name}</p>
          <p className="brand-location">
            <MapPin size={14} aria-hidden="true" /> {settings.location}
          </p>
        </div>
        <Link
          className="icon-button"
          href={adminHref}
          aria-label={isAdmin ? "Open admin editor" : "Admin sign in"}
        >
          <Settings2 size={21} />
        </Link>
      </header>

      <div className="page-grid">
        <section className="next-prayer-panel" aria-labelledby="next-prayer-heading">
          <div className="arch-line" aria-hidden="true" />
          <p className="today-line">
            <CalendarDays size={17} aria-hidden="true" /> {formattedDate}
          </p>
          <div className="next-prayer-copy">
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
          </div>
          <button
            className="notify-button"
            type="button"
            onClick={enableNotifications}
            disabled={alertState === "working" || alertState === "enabled"}
          >
            {alertState === "enabled" ? (
              <Check size={19} />
            ) : alertState === "working" ? (
              <BellRing size={19} />
            ) : (
              <Bell size={19} />
            )}
            {alertState === "enabled"
              ? "Alerts enabled"
              : alertState === "working"
                ? "Enabling…"
                : "Alert me to changes"}
          </button>
        </section>

        <section className="schedule-panel" aria-labelledby="schedule-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Today</p>
              <h2 id="schedule-heading">Prayer timetable</h2>
            </div>
            <Clock3 size={22} aria-hidden="true" />
          </div>

          <div className="schedule-head" aria-hidden="true">
            <span>Prayer</span>
            <span>Begins</span>
            <span>Jamaat</span>
          </div>
          <ol className="schedule-list">
            {times.map((item, index) => (
              <li
                key={item.prayer}
                className={index === nextIndex ? "is-next" : undefined}
              >
                <span className="prayer-name">
                  {item.prayer}
                  {index === nextIndex && <small>Next</small>}
                </span>
                <time dateTime={item.prayerStart}>{displayTime(item.prayerStart)}</time>
                <time dateTime={item.jamaat}>{displayTime(item.jamaat)}</time>
              </li>
            ))}
          </ol>
          <p className="updated-note">
            Updated {new Intl.DateTimeFormat("en", {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
              timeZone: settings.timezone,
            }).format(new Date(settings.updatedAt))}
          </p>
        </section>

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
        {isAdmin && <Link href="/admin">Edit timetable</Link>}
      </footer>
    </main>
  );
}
