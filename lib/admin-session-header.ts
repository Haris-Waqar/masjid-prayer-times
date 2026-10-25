// Shared contract for forwarding the middleware-validated admin user to server
// components / route handlers. Kept free of `server-only` and Supabase imports
// so it is safe to import from edge middleware (proxy.ts).

export const ADMIN_USER_HEADER = "x-admin-user";

export type ForwardedAdminUser = {
  id: string;
  email: string;
  mustChangePassword: boolean;
};

export function serializeForwardedUser(user: ForwardedAdminUser): string {
  return JSON.stringify(user);
}

export function parseForwardedUser(
  raw: string | null | undefined,
): ForwardedAdminUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ForwardedAdminUser>;
    if (typeof parsed.id !== "string" || typeof parsed.email !== "string") {
      return null;
    }
    return {
      id: parsed.id,
      email: parsed.email,
      mustChangePassword: parsed.mustChangePassword === true,
    };
  } catch {
    return null;
  }
}
