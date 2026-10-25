import { getAdminSession } from "@/lib/admin";
import {
  configurationFailure,
  logAdminFailure,
  noStoreJson,
} from "@/lib/admin-api";
import { completeAdminSetup } from "@/lib/admin-management";

export async function POST(request: Request) {
  try {
    const { access, user } = await getAdminSession();
    if (!user || !access)
      return noStoreJson({ error: "Sign in is required." }, { status: 401 });
    if (!access.passwordSetupRequired) {
      return noStoreJson(
        { error: "Password setup is not required." },
        { status: 409 },
      );
    }
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return noStoreJson(
        { error: "Enter a valid new password." },
        { status: 400 },
      );
    }
    const password = (input as { password?: unknown })?.password;
    if (
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    ) {
      return noStoreJson(
        { error: "Use a password between 12 and 128 characters." },
        { status: 400 },
      );
    }
    await completeAdminSetup(user, password);
    return noStoreJson({ ok: true });
  } catch (error) {
    const configured = configurationFailure(error);
    if (configured) return configured;
    logAdminFailure("complete_password_setup", error, request);
    return noStoreJson(
      { error: "The password could not be updated." },
      { status: 500 },
    );
  }
}
