import { createHash } from "node:crypto";
import {
  isAllowedPushEndpoint,
  isMosqueId,
  isRecord,
  readBoundedJson,
} from "@/lib/push-subscription";
import { createAdminClient } from "@/lib/supabase/admin";

type SubscriptionInput = {
  mosqueId?: string;
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  locale?: string;
};

async function activeMosqueExists(mosqueId: string) {
  const { data, error } = await createAdminClient()
    .from("mosques")
    .select("id")
    .eq("id", mosqueId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function POST(request: Request) {
  const parsed = await readBoundedJson(request);
  if (!parsed.ok) return parsed.response;
  if (!isRecord(parsed.value)) {
    return Response.json({ error: "Invalid push subscription." }, { status: 400 });
  }
  const input = parsed.value as SubscriptionInput;

  if (
    !isMosqueId(input.mosqueId) ||
    !input.endpoint ||
    !isAllowedPushEndpoint(input.endpoint) ||
    !input.keys?.p256dh ||
    !input.keys.auth ||
    input.endpoint.length > 2_048 ||
    input.keys.p256dh.length > 512 ||
    input.keys.auth.length > 256
  ) {
    return Response.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  const locale = input.locale ?? "en";
  if (locale !== "en" && locale !== "ur") {
    return Response.json({ error: "Invalid alert language." }, { status: 400 });
  }

  try {
    if (!(await activeMosqueExists(input.mosqueId))) {
      return Response.json({ error: "Mosque is unavailable." }, { status: 404 });
    }
  } catch {
    return Response.json({ error: "Could not verify this mosque." }, { status: 500 });
  }

  const clientAddress =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const rateSecret = process.env.PUSH_RATE_LIMIT_SECRET ?? process.env.VAPID_PRIVATE_KEY;
  if (!clientAddress || !rateSecret) {
    return Response.json({ error: "Alert registration is not configured." }, { status: 503 });
  }
  const rateKey = createHash("sha256")
    .update(`${rateSecret}:${clientAddress}`)
    .digest("hex");

  const { error } = await createAdminClient().rpc("register_push_subscription", {
    p_mosque_id: input.mosqueId,
    p_endpoint: input.endpoint,
    p_p256dh: input.keys.p256dh,
    p_auth: input.keys.auth,
    p_rate_key: rateKey,
    p_locale: locale,
  });

  if (error?.message.includes("rate limit exceeded")) {
    return Response.json({ error: "Too many attempts. Try again tomorrow." }, { status: 429 });
  }
  if (error) return Response.json({ error: "Could not save this device." }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const parsed = await readBoundedJson(request);
  if (!parsed.ok) return parsed.response;
  if (!isRecord(parsed.value)) {
    return Response.json({ error: "Invalid push subscription." }, { status: 400 });
  }
  const input = parsed.value as SubscriptionInput;

  if (!isMosqueId(input.mosqueId) || !isAllowedPushEndpoint(input.endpoint)) {
    return Response.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("push_subscription_mosques")
    .delete()
    .eq("endpoint", input.endpoint)
    .eq("mosque_id", input.mosqueId);

  if (error) {
    return Response.json(
      { error: "Could not disable alerts for this mosque." },
      { status: 500 },
    );
  }
  return Response.json({ ok: true });
}
