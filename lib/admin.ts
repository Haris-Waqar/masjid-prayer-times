import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function getAuthorizedAdmin(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const { data: admin } = await supabase
    .from("admin_members")
    .select("id")
    .eq("email", user.email.toLowerCase())
    .eq("active", true)
    .maybeSingle();

  return admin ? user : null;
}
