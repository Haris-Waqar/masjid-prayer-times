import { getAdminSession } from "@/lib/admin";
import {
  configurationFailure,
  logAdminFailure,
  noStoreJson,
} from "@/lib/admin-api";
import { canManageMasjids } from "@/lib/admin-policy";
import {
  AdminRequestError,
  isUuid,
  readAdminJson,
} from "@/lib/admin-request";
import {
  LastActiveMosqueError,
  MosqueNotFoundError,
  setManagedMosqueActive,
} from "@/lib/mosque-management";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user, access } = await getAdminSession();
    if (!user) return noStoreJson({ error: "Sign in is required." }, { status: 401 });
    if (!canManageMasjids(access)) {
      return noStoreJson(
        { error: "Mosque-management access is required." },
        { status: 403 },
      );
    }
    const { id } = await context.params;
    if (!isUuid(id)) {
      return noStoreJson({ error: "Mosque not found." }, { status: 404 });
    }
    const input = await readAdminJson(request);
    const record =
      typeof input === "object" && input !== null && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : null;
    const active = record?.active;
    if (
      typeof active !== "boolean" ||
      !record ||
      Object.keys(record).some((key) => key !== "active")
    ) {
      return noStoreJson(
        { error: "Choose whether the mosque should be active." },
        { status: 400 },
      );
    }
    return noStoreJson({
      ok: true,
      mosque: await setManagedMosqueActive(id, active),
    });
  } catch (error) {
    if (error instanceof AdminRequestError) {
      return noStoreJson({ error: error.message }, { status: error.status });
    }
    if (error instanceof MosqueNotFoundError) {
      return noStoreJson({ error: "Mosque not found." }, { status: 404 });
    }
    if (error instanceof LastActiveMosqueError) {
      return noStoreJson(
        { error: "The last active mosque cannot be archived." },
        { status: 409 },
      );
    }
    const configured = configurationFailure(error);
    if (configured) return configured;
    logAdminFailure("update_mosque_status", error, request);
    return noStoreJson(
      { error: "The mosque status could not be updated." },
      { status: 500 },
    );
  }
}
