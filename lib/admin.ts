import "server-only";
import type { User } from "@supabase/supabase-js";
import {
  canEditSchedule,
  canManageAdmins,
  type AdminAccess,
  type AdminRole,
} from "@/lib/admin-policy";
import { createClient } from "@/lib/supabase/server";

type MembershipRow = {
  id: string;
  user_id: string;
  email: string;
  role: AdminRole;
};

export async function getAdminSession(): Promise<{
  access: AdminAccess | null;
  user: User | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) return { access: null, user: null };

  const { data } = await supabase
    .from("admin_members")
    .select("id,user_id,email,role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  const membership = data as MembershipRow | null;
  if (!membership) return { access: null, user };

  return {
    user,
    access: {
      userId: user.id,
      email: membership.email.toLowerCase(),
      membershipId: membership.id,
      role: membership.role,
      passwordSetupRequired: user.app_metadata?.must_change_password === true,
    },
  };
}

export async function getAdminAccess() {
  return (await getAdminSession()).access;
}

export async function getAuthorizedAdmin(): Promise<User | null> {
  const session = await getAdminSession();
  return canEditSchedule(session.access) ? session.user : null;
}

export async function getSuperAdminAccess() {
  const access = await getAdminAccess();
  return canManageAdmins(access) ? access : null;
}
