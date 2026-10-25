import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole, Settings } from "lucide-react";
import { AdminEditor } from "@/app/admin/admin-editor";
import { SignOutButton } from "@/app/admin/sign-out-button";
import { NavigationPendingIcon } from "@/app/navigation-pending-icon";
import { getAdminSession } from "@/lib/admin";
import { dateInTimezone } from "@/lib/prayers";
import { getPrayerTimes, getSettings } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    redirect("/admin/login?setup=required");
  }

  const { access, user } = await getAdminSession();
  if (!user) redirect("/admin/login");
  if (access?.passwordSetupRequired)
    redirect("/admin/reset-password?setup=required");

  if (!access) {
    return (
      <main className="admin-shell">
        <div className="admin-topbar">
          <Link className="back-link" href="/">
            <NavigationPendingIcon kind="back" size={17} /> Back to jamaat times
          </Link>
          <SignOutButton />
        </div>
        <section className="access-denied">
          <LockKeyhole size={28} aria-hidden="true" />
          <h1 className="admin-title">Access is restricted</h1>
          <p className="admin-lede">
            This signed-in account is not on the active administrator list.
          </p>
        </section>
      </main>
    );
  }

  const settings = await getSettings();
  const date = dateInTimezone(settings.timezone);
  const times = await getPrayerTimes(date);

  return (
    <main className="admin-shell">
      <div className="admin-topbar">
        <Link className="back-link" href="/">
          <NavigationPendingIcon kind="back" size={17} /> Back to jamaat times
        </Link>
        <div className="admin-topbar-actions">
          {access.role === "super_admin" ? (
            <Link className="back-link" href="/admin/manage">
              <Settings size={17} aria-hidden="true" /> Manage
            </Link>
          ) : null}
          <SignOutButton />
        </div>
      </div>
      <h1 className="admin-title">Update jamaat times</h1>
      <p className="admin-lede">
        Review every time before posting. People are notified only when a jamaat
        time actually changes.
      </p>
      <AdminEditor
        initialDate={date}
        initialTimes={times}
        editorEmail={access.email}
      />
    </main>
  );
}
