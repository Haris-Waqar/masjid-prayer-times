import { getAdminSession } from "@/lib/admin";
import {
  configurationFailure,
  logAdminFailure,
  noStoreJson,
} from "@/lib/admin-api";
import {
  AdminNotFoundError,
  ProtectedAdminError,
  setRegularAdminMosqueManagement,
} from "@/lib/admin-management";
import { canManageAdmins } from "@/lib/admin-policy";
import {
  AdminRequestError,
  isUuid,
  readAdminJson,
} from "@/lib/admin-request";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user, access } = await getAdminSession();
    if (!user) return noStoreJson({ error: "Sign in is required." }, { status: 401 });
    if (!canManageAdmins(access) || !access) {
      return noStoreJson(
        { error: "Super administrator access is required." },
        { status: 403 },
      );
    }
    const { id } = await context.params;
    if (!isUuid(id)) {
      return noStoreJson({ error: "Administrator not found." }, { status: 404 });
    }
    const input = await readAdminJson(request);
    const record =
      typeof input === "object" && input !== null && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : null;
    const enabled = record?.enabled;
    if (
      typeof enabled !== "boolean" ||
      !record ||
      Object.keys(record).some((key) => key !== "enabled")
    ) {
      return noStoreJson(
        { error: "Choose whether mosque management should be allowed." },
        { status: 400 },
      );
    }
    await setRegularAdminMosqueManagement(id, enabled, access.userId);
    return noStoreJson({ ok: true, enabled });
  } catch (error) {
    if (error instanceof AdminRequestError) {
      return noStoreJson({ error: error.message }, { status: error.status });
    }
    if (error instanceof AdminNotFoundError) {
      return noStoreJson({ error: "Administrator not found." }, { status: 404 });
    }
    if (error instanceof ProtectedAdminError) {
      return noStoreJson(
        { error: "This administrator's permissions cannot be changed." },
        { status: 403 },
      );
    }
    const configured = configurationFailure(error);
    if (configured) return configured;
    logAdminFailure("update_mosque_management_access", error, request);
    return noStoreJson(
      { error: "Mosque-management access could not be updated." },
      { status: 500 },
    );
  }
}
