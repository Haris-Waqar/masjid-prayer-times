import Link from "next/link";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/app/admin/reset-password/reset-password-form";
import { NavigationPendingIcon } from "@/app/navigation-pending-icon";
import { getAuthorizedAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const user = await getAuthorizedAdmin();
  if (!user) redirect("/admin/login?error=recovery");

  return (
    <main className="admin-shell">
      <div className="admin-topbar">
        <Link className="back-link" href="/admin">
          <NavigationPendingIcon kind="back" size={17} /> Back to editor
        </Link>
      </div>
      <section className="admin-card login-card">
        <h1 className="admin-title">Choose a new password</h1>
        <p className="admin-lede">
          Use at least 12 characters. A unique passphrase is easiest to remember.
        </p>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
