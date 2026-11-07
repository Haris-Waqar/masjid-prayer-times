import { getAdminSession } from "@/lib/admin";
import {
  configurationFailure,
  logAdminFailure,
  noStoreJson,
} from "@/lib/admin-api";
import { canManageMasjids } from "@/lib/admin-policy";
import { AdminRequestError, readAdminJson } from "@/lib/admin-request";
import {
  createManagedMosque,
  listManagedMosques,
  MosqueConflictError,
} from "@/lib/mosque-management";
import { validateCreateMosqueInput } from "@/lib/mosques";

async function authorizedManager() {
  const session = await getAdminSession();
  if (!session.user) {
    return { response: noStoreJson({ error: "Sign in is required." }, { status: 401 }) };
  }
  if (!canManageMasjids(session.access) || !session.access) {
    return {
      response: noStoreJson(
        { error: "Mosque-management access is required." },
        { status: 403 },
      ),
    };
  }
  return { access: session.access };
}

export async function GET(request: Request) {
  try {
    const authorization = await authorizedManager();
    if (authorization.response) return authorization.response;
    return noStoreJson({ ok: true, mosques: await listManagedMosques() });
  } catch (error) {
    const configured = configurationFailure(error);
    if (configured) return configured;
    logAdminFailure("list_mosques", error, request);
    return noStoreJson(
      { error: "Mosques could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await authorizedManager();
    if (authorization.response || !authorization.access) return authorization.response;
    const validated = validateCreateMosqueInput(await readAdminJson(request));
    if (!validated.ok) {
      return noStoreJson({ error: validated.error }, { status: 400 });
    }
    const mosque = await createManagedMosque(validated.value, authorization.access);
    return noStoreJson({ ok: true, mosque }, { status: 201 });
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
    const configured = configurationFailure(error);
    if (configured) return configured;
    logAdminFailure("create_mosque", error, request);
    return noStoreJson(
      { error: "The mosque could not be created." },
      { status: 500 },
    );
  }
}
