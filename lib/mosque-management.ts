import "server-only";
import type { AdminAccess } from "@/lib/admin-policy";
import {
  mapMosqueRow,
  type CreateMosqueInput,
  type Mosque,
  type UpdateMosqueInput,
} from "@/lib/mosques";
import { createAdminClient } from "@/lib/supabase/admin";

const MOSQUE_COLUMNS =
  "id,slug,name,location,timezone,active,created_at,updated_at";

export class MosqueConflictError extends Error {}
export class MosqueNotFoundError extends Error {}
export class LastActiveMosqueError extends Error {}

function hasDatabaseCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function requireMosque(row: unknown): Mosque {
  const mosque = mapMosqueRow(row);
  if (!mosque) throw new Error("Database returned an invalid mosque record");
  return mosque;
}

export async function listManagedMosques(): Promise<Mosque[]> {
  const result = await createAdminClient()
    .from("mosques")
    .select(MOSQUE_COLUMNS)
    .order("name");
  if (result.error) {
    throw new Error("Could not list mosques", { cause: result.error });
  }
  return (result.data ?? []).map(requireMosque);
}

export async function createManagedMosque(
  input: CreateMosqueInput,
  actor: AdminAccess,
): Promise<Mosque> {
  const supabase = createAdminClient();
  const created = await supabase
    .from("mosques")
    .insert(input)
    .select(MOSQUE_COLUMNS)
    .single();

  if (created.error) {
    if (hasDatabaseCode(created.error, "23505")) {
      throw new MosqueConflictError("Mosque slug already exists");
    }
    throw new Error("Could not create mosque", { cause: created.error });
  }

  const mosque = requireMosque(created.data);
  if (actor.role === "super_admin") return mosque;

  const assignment = await supabase.from("admin_mosque_access").insert({
    admin_member_id: actor.membershipId,
    mosque_id: mosque.id,
  });
  if (!assignment.error) return mosque;

  const compensation = await supabase.from("mosques").delete().eq("id", mosque.id);
  if (compensation.error) {
    console.error("Mosque creation compensation failed", {
      operation: "delete_unassigned_mosque",
      mosqueId: mosque.id,
    });
  }
  throw new Error("Could not assign the mosque creator", {
    cause: assignment.error,
  });
}

export async function updateManagedMosque(
  mosqueId: string,
  input: UpdateMosqueInput,
): Promise<Mosque> {
  const result = await createAdminClient()
    .from("mosques")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", mosqueId)
    .select(MOSQUE_COLUMNS)
    .maybeSingle();

  if (result.error) {
    if (hasDatabaseCode(result.error, "23505")) {
      throw new MosqueConflictError("Mosque slug already exists");
    }
    throw new Error("Could not update mosque", { cause: result.error });
  }
  if (!result.data) throw new MosqueNotFoundError("Mosque not found");
  return requireMosque(result.data);
}

export async function setManagedMosqueActive(
  mosqueId: string,
  active: boolean,
): Promise<Mosque> {
  const supabase = createAdminClient();
  const existing = await supabase
    .from("mosques")
    .select(MOSQUE_COLUMNS)
    .eq("id", mosqueId)
    .maybeSingle();
  if (existing.error) {
    throw new Error("Could not load mosque", { cause: existing.error });
  }
  if (!existing.data) throw new MosqueNotFoundError("Mosque not found");
  const mosque = requireMosque(existing.data);
  if (mosque.active === active) return mosque;

  if (!active) {
    const countResult = await supabase
      .from("mosques")
      .select("id", { count: "exact", head: true })
      .eq("active", true);
    if (countResult.error) {
      throw new Error("Could not count active mosques", {
        cause: countResult.error,
      });
    }
    if ((countResult.count ?? 0) <= 1) {
      throw new LastActiveMosqueError("The last active mosque cannot be archived");
    }
  }

  const updated = await supabase
    .from("mosques")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", mosqueId)
    .select(MOSQUE_COLUMNS)
    .single();
  if (updated.error) {
    throw new Error("Could not update mosque status", { cause: updated.error });
  }
  return requireMosque(updated.data);
}
