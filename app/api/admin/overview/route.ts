import { getAdminSession } from "@/lib/admin";
import {
  configurationFailure,
  logAdminFailure,
  noStoreJson,
} from "@/lib/admin-api";
import { loadAdminOverview } from "@/lib/admin-management";
import { canManageAdmins } from "@/lib/admin-policy";

export async function GET(request: Request) {
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
    return noStoreJson({ ok: true, ...(await loadAdminOverview()) });
  } catch (error) {
    const configured = configurationFailure(error);
    if (configured) return configured;
    logAdminFailure("load_overview", error, request);
    return noStoreJson(
      { error: "The management overview could not be loaded." },
      { status: 500 },
    );
  }
}
