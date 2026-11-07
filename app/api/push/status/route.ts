import {
  isAllowedPushEndpoint,
  isMosqueId,
  isRecord,
  readBoundedJson,
} from "@/lib/push-subscription";
import { createAdminClient } from "@/lib/supabase/admin";

type StatusInput = {
  mosqueId?: string;
  endpoint?: string;
};

function noStoreJson(body: object, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export async function POST(request: Request) {
  const parsed = await readBoundedJson(request);
  if (!parsed.ok) return parsed.response;
  if (!isRecord(parsed.value)) {
    return noStoreJson({ error: "Invalid alert status request." }, { status: 400 });
  }
  const input = parsed.value as StatusInput;
  if (!isMosqueId(input.mosqueId) || !isAllowedPushEndpoint(input.endpoint)) {
    return noStoreJson({ error: "Invalid alert status request." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const mosque = await supabase
    .from("mosques")
    .select("id")
    .eq("id", input.mosqueId)
    .eq("active", true)
    .maybeSingle();
  if (mosque.error) {
    return noStoreJson({ error: "Could not check alert status." }, { status: 500 });
  }
  if (!mosque.data) {
    return noStoreJson({ error: "Mosque is unavailable." }, { status: 404 });
  }

  const association = await supabase
    .from("push_subscription_mosques")
    .select("mosque_id")
    .eq("endpoint", input.endpoint)
    .eq("mosque_id", input.mosqueId)
    .maybeSingle();
  if (association.error) {
    return noStoreJson({ error: "Could not check alert status." }, { status: 500 });
  }

  return noStoreJson({ ok: true, subscribed: Boolean(association.data) });
}
