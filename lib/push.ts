import "server-only";
import {
  buildPushPayload,
  type PushSubscription,
  type VapidKeys,
} from "@block65/webcrypto-web-push";
import {
  notificationForLocale,
  type PrayerChange,
} from "@/lib/prayer-change-notification";
import { mosquePublicPath } from "@/lib/mosques";
import { createAdminClient } from "@/lib/supabase/admin";

export type MosqueAlertTarget = {
  id: string;
  slug: string;
  name: string;
};

type SavedSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string | null;
};

export async function notifyPrayerChanges(
  mosque: MosqueAlertTarget,
  date: string,
  changes: PrayerChange[],
) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (changes.length === 0 || !publicKey || !privateKey || !subject) return 0;

  const supabase = createAdminClient();
  const vapid: VapidKeys = { subject, publicKey, privateKey };
  const mosqueUrl = mosquePublicPath(mosque.slug);

  let delivered = 0;
  const pageSize = 500;
  const batchSize = 20;
  for (let offset = 0; ; offset += pageSize) {
    const { data: associations, error: associationError } = await supabase
      .from("push_subscription_mosques")
      .select("endpoint")
      .eq("mosque_id", mosque.id)
      .order("endpoint")
      .range(offset, offset + pageSize - 1);
    if (associationError) throw associationError;

    const associationPage = associations ?? [];
    const endpoints = associationPage.map((item) => item.endpoint);
    let page: SavedSubscription[] = [];
    if (endpoints.length > 0) {
      const { data: subscriptions, error: subscriptionError } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth, locale")
        .in("endpoint", endpoints);
      if (subscriptionError) throw subscriptionError;

      const byEndpoint = new Map(
        ((subscriptions ?? []) as SavedSubscription[]).map((saved) => [
          saved.endpoint,
          saved,
        ]),
      );
      page = endpoints.flatMap((endpoint) => {
        const saved = byEndpoint.get(endpoint);
        return saved ? [saved] : [];
      });
    }

    for (let index = 0; index < page.length; index += batchSize) {
      const batch = page.slice(index, index + batchSize);
      await Promise.allSettled(batch.map(async (saved) => {
      const subscription: PushSubscription = {
        endpoint: saved.endpoint,
        expirationTime: null,
        keys: { p256dh: saved.p256dh, auth: saved.auth },
      };
      const notification = notificationForLocale(saved.locale, date, changes);
      const payload = await buildPushPayload(
        {
          data: JSON.stringify({
            title: `${mosque.name} · ${notification.title}`,
            body: notification.body,
            url: mosqueUrl,
            tag: `prayer-change-${mosque.id}-${date}`,
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
    if (associationPage.length < pageSize) break;
  }

  return delivered;
}
