import { getAdminSession } from "@/lib/admin";
import {
  configurationFailure,
  logAdminFailure,
  noStoreJson,
} from "@/lib/admin-api";
import { AdminConflictError, createRegularAdmin } from "@/lib/admin-management";
import { canManageAdmins } from "@/lib/admin-policy";
import {
  generateTemporaryPassword,
  isValidAdminEmail,
  normalizeAdminEmail,
} from "@/lib/admin-validation";

export async function POST(request: Request) {
  try {
    const { access, user } = await getAdminSession();
    if (!user)
      return noStoreJson({ error: "Sign in is required." }, { status: 401 });
    if (!canManageAdmins(access)) {
      return noStoreJson(
        { error: "Super administrator access is required." },
        { status: 403 },
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 2_048) {
      return noStoreJson(
        { error: "The request is too large." },
        { status: 400 },
      );
    }
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return noStoreJson(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }
    const email = normalizeAdminEmail((input as { email?: unknown })?.email);
    if (!isValidAdminEmail(email)) {
      return noStoreJson(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    await createRegularAdmin(email, temporaryPassword);
    return noStoreJson({ ok: true, email, temporaryPassword }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminConflictError) {
      return noStoreJson(
        { error: "An administrator with this email already exists." },
        { status: 409 },
      );
    }
    const configured = configurationFailure(error);
    if (configured) return configured;
    logAdminFailure("create_admin", error, request);
    return noStoreJson(
      { error: "The administrator could not be created." },
      { status: 500 },
    );
  }
}
