import { getAdminSession } from "@/lib/admin";
import {
  configurationFailure,
  logAdminFailure,
  noStoreJson,
} from "@/lib/admin-api";
import {
  AdminNotFoundError,
  deleteRegularAdmin,
  ProtectedAdminError,
  setRegularAdminActive,
} from "@/lib/admin-management";
import { canManageAdmins } from "@/lib/admin-policy";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { access, user } = await getAdminSession();
    if (!user)
      return noStoreJson({ error: "Sign in is required." }, { status: 401 });
    if (!canManageAdmins(access) || !access) {
      return noStoreJson(
        { error: "Super administrator access is required." },
        { status: 403 },
      );
    }
    const { id } = await context.params;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      return noStoreJson(
        { error: "Administrator not found." },
        { status: 404 },
      );
    }
    await deleteRegularAdmin(id, access.userId);
    return noStoreJson({ ok: true });
  } catch (error) {
    if (error instanceof AdminNotFoundError) {
      return noStoreJson(
        { error: "Administrator not found." },
        { status: 404 },
      );
    }
    if (error instanceof ProtectedAdminError) {
      return noStoreJson(
        { error: "This administrator cannot be deleted." },
        { status: 403 },
      );
    }
    const configured = configurationFailure(error);
    if (configured) return configured;
    logAdminFailure("delete_admin", error, request);
    return noStoreJson(
      { error: "The administrator could not be deleted." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { access, user } = await getAdminSession();
    if (!user)
      return noStoreJson({ error: "Sign in is required." }, { status: 401 });
    if (!canManageAdmins(access) || !access) {
      return noStoreJson(
        { error: "Super administrator access is required." },
        { status: 403 },
      );
    }
    const { id } = await context.params;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      return noStoreJson(
        { error: "Administrator not found." },
        { status: 404 },
      );
    }
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return noStoreJson(
        { error: "Choose whether access should be active." },
        { status: 400 },
      );
    }
    const active = (input as { active?: unknown })?.active;
    if (typeof active !== "boolean") {
      return noStoreJson(
        { error: "Choose whether access should be active." },
        { status: 400 },
      );
    }
    await setRegularAdminActive(id, active, access.userId);
    return noStoreJson({ ok: true, active });
  } catch (error) {
    if (error instanceof AdminNotFoundError) {
      return noStoreJson(
        { error: "Administrator not found." },
        { status: 404 },
      );
    }
    if (error instanceof ProtectedAdminError) {
      return noStoreJson(
        { error: "This administrator's access cannot be changed." },
        { status: 403 },
      );
    }
    const configured = configurationFailure(error);
    if (configured) return configured;
    logAdminFailure("update_admin_access", error, request);
    return noStoreJson(
      { error: "Administrator access could not be updated." },
      { status: 500 },
    );
  }
}
