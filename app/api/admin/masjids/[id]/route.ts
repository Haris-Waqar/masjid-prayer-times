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
  MosqueConflictError,
  MosqueNotFoundError,
  updateManagedMosque,
} from "@/lib/mosque-management";
import { validateUpdateMosqueInput } from "@/lib/mosques";

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
    const validated = validateUpdateMosqueInput(await readAdminJson(request));
    if (!validated.ok) {
      return noStoreJson({ error: validated.error }, { status: 400 });
    }
    return noStoreJson({
      ok: true,
      mosque: await updateManagedMosque(id, validated.value),
    });
  } catch (error) {
    if (error instanceof AdminRequestError) {
      return noStoreJson({ error: error.message }, { status: error.status });
    }
    if (error instanceof MosqueConflictError) {
      return noStoreJson(
        { error: "A mosque with this slug already exists." },
        { status: 409 },
      );
    }
    if (error instanceof MosqueNotFoundError) {
      return noStoreJson({ error: "Mosque not found." }, { status: 404 });
    }
    const configured = configurationFailure(error);
    if (configured) return configured;
    logAdminFailure("update_mosque", error, request);
    return noStoreJson(
      { error: "The mosque could not be updated." },
      { status: 500 },
    );
  }
}
