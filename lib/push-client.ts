/**
 * Browser-only helpers for subscribing this device to a mosque's changed-time
 * alerts. Import only from Client Components.
 */

export type AlertStatus = "unsupported" | "blocked" | "enabled" | "idle";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

/** Registers the app's service worker (idempotent) and waits until it is active. */
export async function readyServiceWorker(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

/** Whether this device already receives alerts for `mosqueId`, without prompting. */
export async function readAlertStatus(mosqueId: string): Promise<AlertStatus> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "idle";

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return "idle";

  const response = await fetch("/api/push/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mosqueId, endpoint: subscription.endpoint }),
  });
  const status = (await response.json().catch(() => ({}))) as { subscribed?: boolean };
  return response.ok && status.subscribed ? "enabled" : "idle";
}

/**
 * Asks for notification permission and subscribes this device to `mosqueId`.
 * Throws an Error with a user-facing message when it cannot.
 */
export async function subscribeToMosqueAlerts(mosqueId: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }
  const configResponse = await fetch("/api/push/config");
  const config = (await configResponse.json().catch(() => ({}))) as { publicKey?: string };
  if (!config.publicKey) {
    throw new Error("Notifications are awaiting final mosque setup.");
  }
  const registration = await readyServiceWorker();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    }));
  const keys = subscription.toJSON().keys;
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mosqueId,
      endpoint: subscription.endpoint,
      keys: { p256dh: keys?.p256dh, auth: keys?.auth },
      locale: navigator.language.toLowerCase().startsWith("ur") ? "ur" : "en",
    }),
  });
  if (!response.ok) throw new Error("This device could not be registered.");
}
