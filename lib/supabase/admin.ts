import "server-only";
import { createClient } from "@supabase/supabase-js";

export class SupabaseAdminConfigurationError extends Error {
  constructor() {
    super("Supabase server credentials are not configured.");
    this.name = "SupabaseAdminConfigurationError";
  }
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new SupabaseAdminConfigurationError();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
