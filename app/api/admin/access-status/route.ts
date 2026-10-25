import { getAdminSession } from "@/lib/admin";
import { logAdminFailure, noStoreJson } from "@/lib/admin-api";

export async function GET(request: Request) {
  try {
    const { access, user } = await getAdminSession();
    if (!user)
      return noStoreJson({ error: "Sign in is required." }, { status: 401 });
    if (!access) {
      return noStoreJson(
        {
          error:
            "Administrator access is inactive or has been revoked. Contact the super administrator.",
        },
        { status: 403 },
      );
    }
    return noStoreJson({
      ok: true,
      passwordSetupRequired: access.passwordSetupRequired,
    });
  } catch (error) {
    logAdminFailure("check_admin_access", error, request);
    return noStoreJson(
      {
        error: "Administrator access could not be verified. Please try again.",
      },
      { status: 500 },
    );
  }
}
