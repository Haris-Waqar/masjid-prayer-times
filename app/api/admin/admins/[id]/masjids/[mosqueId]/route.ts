import { getAdminSession } from "@/lib/admin";
import {
  configurationFailure,
  logAdminFailure,
  noStoreJson,
} from "@/lib/admin-api";
import {
  AdminNotFoundError,
  MosqueAssignmentError,
  ProtectedAdminError,
  setRegularAdminMosqueAssignment,
} from "@/lib/admin-management";
import { canManageAdmins } from "@/lib/admin-policy";
import { isUuid } from "@/lib/admin-request";

type Context = { params: Promise<{ id: string; mosqueId: string }> };

async function updateAssignment(
  request: Request,
  context: Context,
  assigned: boolean,
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
    const { id, mosqueId } = await context.params;
    if (!isUuid(id)) {
      return noStoreJson({ error: "Administrator not found." }, { status: 404 });
    }
    if (!isUuid(mosqueId)) {
      return noStoreJson({ error: "Mosque not found." }, { status: 404 });
    }
    await setRegularAdminMosqueAssignment(
      id,
      mosqueId,
      assigned,
      access.userId,
    );
    return noStoreJson({ ok: true, assigned });
  } catch (error) {
    if (error instanceof AdminNotFoundError) {
      return noStoreJson({ error: "Administrator not found." }, { status: 404 });
    }
    if (error instanceof MosqueAssignmentError) {
      return noStoreJson({ error: "Mosque not found." }, { status: 404 });
    }
    if (error instanceof ProtectedAdminError) {
      return noStoreJson(
        { error: "This administrator's assignments cannot be changed." },
        { status: 403 },
      );
    }
    const configured = configurationFailure(error);
    if (configured) return configured;
    logAdminFailure("update_mosque_assignment", error, request);
    return noStoreJson(
      { error: "The mosque assignment could not be updated." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: Context) {
  return updateAssignment(request, context, true);
}

export async function DELETE(request: Request, context: Context) {
  return updateAssignment(request, context, false);
}
