import "server-only";
import { SupabaseAdminConfigurationError } from "@/lib/supabase/admin";

export function noStoreJson(
  body: Record<string, unknown>,
  init?: ResponseInit,
) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export function logAdminFailure(
  operation: string,
  error: unknown,
  request?: Request,
) {
  console.error("Admin operation failed", {
    operation,
    method: request?.method,
    path: request ? new URL(request.url).pathname : undefined,
    error:
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "UnknownError" },
  });
}

export function configurationFailure(error: unknown) {
  if (!(error instanceof SupabaseAdminConfigurationError)) return null;
  return noStoreJson(
    {
      error:
        "Server setup is incomplete. Please contact the site administrator.",
    },
    { status: 503 },
  );
}
