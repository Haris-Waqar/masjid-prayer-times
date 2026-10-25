import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminRole } from "@/lib/admin-policy";

export type SafeAdmin = {
  id: string;
  email: string;
  role: AdminRole;
  active: boolean;
  createdAt: string;
};

export type AdminOverview = {
  admins: SafeAdmin[];
  statistics: {
    totalDevices: number;
    englishDevices: number;
    urduDevices: number;
    devicesCreatedLast30Days: number;
    devicesRefreshedLast30Days: number;
    activeAdmins: number;
    timetableChangesLast30Days: number;
    latestTimetableChange: string | null;
    updatedAt: string;
  };
};

export class AdminConflictError extends Error {}
export class AdminNotFoundError extends Error {}
export class ProtectedAdminError extends Error {}

function assertQuery<T>(
  result: { data: T | null; error: unknown },
  operation: string,
) {
  if (result.error)
    throw new Error(`Supabase operation failed: ${operation}`, {
      cause: result.error,
    });
  return result.data;
}

function count(
  result: { count: number | null; error: unknown },
  operation: string,
) {
  if (result.error)
    throw new Error(`Supabase operation failed: ${operation}`, {
      cause: result.error,
    });
  return result.count ?? 0;
}

export async function loadAdminOverview(): Promise<AdminOverview> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [
    adminsResult,
    total,
    english,
    urdu,
    created,
    refreshed,
    changes,
    latest,
  ] = await Promise.all([
    supabase
      .from("admin_members")
      .select("id,email,role,active,created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("push_subscriptions")
      .select("endpoint", { count: "exact", head: true }),
    supabase
      .from("push_subscriptions")
      .select("endpoint", { count: "exact", head: true })
      .eq("locale", "en"),
    supabase
      .from("push_subscriptions")
      .select("endpoint", { count: "exact", head: true })
      .eq("locale", "ur"),
    supabase
      .from("push_subscriptions")
      .select("endpoint", { count: "exact", head: true })
      .gte("created_at", since),
    supabase
      .from("push_subscriptions")
      .select("endpoint", { count: "exact", head: true })
      .gte("last_seen_at", since),
    supabase
      .from("change_history")
      .select("id", { count: "exact", head: true })
      .gte("changed_at", since),
    supabase
      .from("change_history")
      .select("changed_at")
      .order("changed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const rows = assertQuery(adminsResult, "list admins") ?? [];
  const latestRow = assertQuery(latest, "load latest timetable change") as {
    changed_at: string;
  } | null;

  return {
    admins: rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role as AdminRole,
      active: row.active,
      createdAt: row.created_at,
    })),
    statistics: {
      totalDevices: count(total, "count devices"),
      englishDevices: count(english, "count English devices"),
      urduDevices: count(urdu, "count Urdu devices"),
      devicesCreatedLast30Days: count(created, "count new devices"),
      devicesRefreshedLast30Days: count(refreshed, "count refreshed devices"),
      activeAdmins: rows.filter((row) => row.active).length,
      timetableChangesLast30Days: count(changes, "count timetable changes"),
      latestTimetableChange: latestRow?.changed_at ?? null,
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function setRegularAdminActive(
  membershipId: string,
  active: boolean,
  actorUserId: string,
) {
  const supabase = createAdminClient();
  const result = await supabase
    .from("admin_members")
    .select("id,user_id,role,active")
    .eq("id", membershipId)
    .maybeSingle();
  if (result.error)
    throw new Error("Could not load admin membership", { cause: result.error });
  if (!result.data) throw new AdminNotFoundError("Administrator not found");
  if (result.data.user_id === actorUserId || result.data.role !== "admin") {
    throw new ProtectedAdminError("This administrator cannot be changed");
  }
  if (result.data.active === active) return;

  const update = await supabase
    .from("admin_members")
    .update({ active })
    .eq("id", membershipId)
    .eq("role", "admin");
  if (update.error)
    throw new Error("Could not update admin access", { cause: update.error });
}

export async function createRegularAdmin(
  email: string,
  temporaryPassword: string,
) {
  const supabase = createAdminClient();
  const existing = await supabase
    .from("admin_members")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing.error)
    throw new Error("Could not check admin membership", {
      cause: existing.error,
    });
  if (existing.data)
    throw new AdminConflictError("Administrator already exists");

  const created = await supabase.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { must_change_password: true },
  });
  if (created.error || !created.data.user) {
    if (/already|registered|exists/i.test(created.error?.message ?? "")) {
      throw new AdminConflictError("Administrator already exists");
    }
    throw new Error("Could not create Auth user", { cause: created.error });
  }

  const membership = await supabase.from("admin_members").insert({
    user_id: created.data.user.id,
    email,
    role: "admin",
    active: true,
  });
  if (membership.error) {
    const compensation = await supabase.auth.admin.deleteUser(
      created.data.user.id,
    );
    if (compensation.error) {
      console.error("Admin creation compensation failed", {
        operation: "delete_orphaned_auth_user",
        userId: created.data.user.id,
      });
    }
    throw new Error("Could not create admin membership", {
      cause: membership.error,
    });
  }
}

export async function deleteRegularAdmin(
  membershipId: string,
  actorUserId: string,
) {
  const supabase = createAdminClient();
  const result = await supabase
    .from("admin_members")
    .select("id,user_id,role")
    .eq("id", membershipId)
    .maybeSingle();
  if (result.error)
    throw new Error("Could not load admin membership", { cause: result.error });
  if (!result.data) throw new AdminNotFoundError("Administrator not found");
  if (result.data.user_id === actorUserId || result.data.role !== "admin") {
    throw new ProtectedAdminError("This administrator cannot be deleted");
  }

  const deletion = await supabase.auth.admin.deleteUser(result.data.user_id);
  if (deletion.error)
    throw new Error("Could not delete Auth user", { cause: deletion.error });
}

export async function completeAdminSetup(user: User, password: string) {
  const supabase = createAdminClient();
  const result = await supabase.auth.admin.updateUserById(user.id, {
    password,
    app_metadata: {
      ...user.app_metadata,
      must_change_password: false,
    },
  });
  if (result.error)
    throw new Error("Could not complete password setup", {
      cause: result.error,
    });
}
