import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import {
  canEditSchedule,
  canManageAdmins,
  type AdminAccess,
  type AdminRole,
} from "@/lib/admin-policy";
import { mapMosqueRow } from "@/lib/mosques";
import {
  ADMIN_USER_HEADER,
  parseForwardedUser,
} from "@/lib/admin-session-header";
import { createClient } from "@/lib/supabase/server";

type MembershipRow = {
  id: string;
  user_id: string;
  email: string;
  role: AdminRole;
  can_manage_mosjids: boolean;
};

const MOSQUE_COLUMNS =
  "id,slug,name,location,timezone,active,created_at,updated_at";

type MappedMosque = NonNullable<ReturnType<typeof mapMosqueRow>>;

function isMappedMosque(
  mosque: ReturnType<typeof mapMosqueRow>,
): mosque is MappedMosque {
  return mosque !== null;
}

async function loadAccessibleMosques(
  supabase: Awaited<ReturnType<typeof createClient>>,
  membership: MembershipRow,
) {
  if (membership.role === "super_admin") {
    const result = await supabase
      .from("mosques")
      .select(MOSQUE_COLUMNS)
      .eq("active", true)
      .order("name");
    if (result.error) throw result.error;
    return (result.data ?? []).map(mapMosqueRow).filter(isMappedMosque);
  }

  const result = await supabase
    .from("admin_mosque_access")
    .select(`mosque_id,mosques(${MOSQUE_COLUMNS})`)
    .eq("admin_member_id", membership.id);
  if (result.error) throw result.error;

  return (result.data ?? [])
    .map((assignment) => {
      const related = assignment.mosques;
      return mapMosqueRow(Array.isArray(related) ? related[0] : related);
    })
    .filter(isMappedMosque)
    .filter((row) => row.active)
    .sort((left, right) => left.name.localeCompare(right.name));
}

// The proxy middleware validates the session once per request and forwards the
// user via a trusted header, so we can skip a second network round-trip to the
// auth server here. If the header is absent (e.g. a request that bypassed the
// middleware), fall back to validating directly.
async function resolveRequestUser(): Promise<User | null> {
  const forwarded = parseForwardedUser(
    (await headers()).get(ADMIN_USER_HEADER),
  );
  if (forwarded) {
    return {
      id: forwarded.id,
      email: forwarded.email,
      app_metadata: { must_change_password: forwarded.mustChangePassword },
    } as unknown as User;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Deduplicated per server request: the proxy, pages, and API routes all need
// the session, and React.cache collapses repeated calls within one request
// into a single auth validation + membership lookup.
export const getAdminSession = cache(async function getAdminSession(): Promise<{
  access: AdminAccess | null;
  user: User | null;
}> {
  const user = await resolveRequestUser();

  if (!user?.id || !user.email) return { access: null, user: null };

  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_members")
    .select("id,user_id,email,role,can_manage_mosjids")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  const membership = data as MembershipRow | null;
  if (!membership) return { access: null, user };

  const mosques = await loadAccessibleMosques(supabase, membership);

  return {
    user,
    access: {
      userId: user.id,
      email: membership.email.toLowerCase(),
      membershipId: membership.id,
      role: membership.role,
      canManageMasjids: membership.can_manage_mosjids,
      assignedMosqueIds: mosques.map((mosque) => mosque.id),
      assignedMosques: mosques.map((mosque) => ({
        id: mosque.id,
        slug: mosque.slug,
        name: mosque.name,
        location: mosque.location,
        timezone: mosque.timezone,
      })),
      passwordSetupRequired: user.app_metadata?.must_change_password === true,
    },
  };
});

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
