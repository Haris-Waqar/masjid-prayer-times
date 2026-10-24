import "server-only";
import {
  buildPushPayload,
  type PushSubscription,
  type VapidKeys,
} from "@block65/webcrypto-web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PrayerName } from "@/lib/prayers";

type PrayerChange = {
  prayer: PrayerName;
  oldJamaat: string;
  newJamaat: string;
};

function displayTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}

export async function notifyPrayerChanges(date: string, changes: PrayerChange[]) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (changes.length === 0 || !publicKey || !privateKey || !subject) return 0;

  const supabase = createAdminClient();
  const vapid: VapidKeys = { subject, publicKey, privateKey };
  const body =
    changes.length === 1
      ? `${changes[0].prayer} jamaat: ${displayTime(changes[0].oldJamaat)} → ${displayTime(changes[0].newJamaat)}`
      : `${changes.length} jamaat times were updated for ${date}.`;

  let delivered = 0;
  const pageSize = 500;
  const batchSize = 20;
  for (let offset = 0; ; offset += pageSize) {
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .order("endpoint")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;

    const page = subscriptions ?? [];
    for (let index = 0; index < page.length; index += batchSize) {
      const batch = page.slice(index, index + batchSize);
      await Promise.allSettled(batch.map(async (saved) => {
      const subscription: PushSubscription = {
        endpoint: saved.endpoint,
        expirationTime: null,
        keys: { p256dh: saved.p256dh, auth: saved.auth },
      };
      const payload = await buildPushPayload(
        {
          data: JSON.stringify({
            title: "Prayer time changed",
            body,
            url: "/",
            tag: `prayer-change-${date}`,
          }),
          options: { ttl: 60 * 60 * 6 },
        },
        subscription,
        vapid,
      );
      const response = await fetch(saved.endpoint, {
        ...payload,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) {
        delivered += 1;
      } else if (response.status === 404 || response.status === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", saved.endpoint);
      }
      }));
    }
    if (page.length < pageSize) break;
  }

  return delivered;
}
