export const MAX_PUSH_BODY_BYTES = 8_192;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMosqueId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isAllowedPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) {
      return false;
    }
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

export async function readBoundedJson(
  request: Request,
): Promise<
  | { ok: true; value: unknown }
  | { ok: false; response: Response }
> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (
    !Number.isFinite(declaredLength) ||
    declaredLength < 0 ||
    declaredLength > MAX_PUSH_BODY_BYTES
  ) {
    return {
      ok: false,
      response: Response.json({ error: "Request is too large." }, { status: 413 }),
    };
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_PUSH_BODY_BYTES) {
    return {
      ok: false,
      response: Response.json({ error: "Request is too large." }, { status: 413 }),
    };
  }

  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Invalid JSON." }, { status: 400 }),
    };
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
