import "server-only";

export const ADMIN_JSON_MAX_BYTES = 16_384;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AdminRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export async function readAdminJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > ADMIN_JSON_MAX_BYTES) {
    throw new AdminRequestError("Request is too large.", 413);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > ADMIN_JSON_MAX_BYTES) {
    throw new AdminRequestError("Request is too large.", 413);
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AdminRequestError("Invalid JSON.", 400);
  }
}
