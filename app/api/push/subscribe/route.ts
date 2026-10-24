import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BODY_BYTES = 8_192;

type SubscriptionInput = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

function isAllowedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return (
      host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host === "web.push.apple.com" ||
      host.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Request is too large." }, { status: 413 });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Request is too large." }, { status: 413 });
  }

  let input: SubscriptionInput;
  try {
    input = JSON.parse(raw) as SubscriptionInput;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (
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
    p_endpoint: input.endpoint,
    p_p256dh: input.keys.p256dh,
    p_auth: input.keys.auth,
    p_rate_key: rateKey,
  });

  if (error?.message.includes("rate limit exceeded")) {
    return Response.json({ error: "Too many attempts. Try again tomorrow." }, { status: 429 });
  }
  if (error) return Response.json({ error: "Could not save this device." }, { status: 500 });
  return Response.json({ ok: true });
}
