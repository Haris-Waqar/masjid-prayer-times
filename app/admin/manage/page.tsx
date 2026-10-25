import Link from "next/link";
import { redirect } from "next/navigation";
import { ManagementDashboard } from "@/app/admin/manage/_components/management-dashboard";
import { SignOutButton } from "@/app/admin/sign-out-button";
import { NavigationPendingIcon } from "@/app/navigation-pending-icon";
import { getAdminSession } from "@/lib/admin";
import { loadAdminOverview } from "@/lib/admin-management";

export const dynamic = "force-dynamic";

export default async function ManageAdminsPage() {
  const { access, user } = await getAdminSession();
  if (!user) redirect("/admin/login");
  if (access?.passwordSetupRequired)
    redirect("/admin/reset-password?setup=required");
  if (access?.role !== "super_admin") redirect("/admin");

  const overview = await loadAdminOverview();
  return (
    <main className="admin-shell management-shell">
      <div className="admin-topbar">
        <Link className="back-link" href="/admin">
          <NavigationPendingIcon kind="back" size={17} /> Back to timetable
        </Link>
        <SignOutButton />
      </div>
      <h1 className="admin-title">Manage administrators</h1>
      <p className="admin-lede">
        Add regular administrators, review notification registrations, and keep
        access limited to people who need it.
      </p>
      <ManagementDashboard initialOverview={overview} />
    </main>
  );
}
