import { redirect } from "next/navigation";
import { ManageScreen } from "@/app/admin/manage/manage-screen";
import { getAdminSession } from "@/lib/admin";
import { canManageAdmins } from "@/lib/admin-policy";

export default async function ManageAdminsPage() {
  const { user, access } = await getAdminSession();
  if (!user) redirect("/admin/login");
  if (access?.passwordSetupRequired) {
    redirect("/admin/reset-password?setup=required");
  }
  // Regular admins must never paint the management shell — send them back to
  // the timetable editor before any client bootstrap runs.
  if (!canManageAdmins(access)) redirect("/admin");

  return <ManageScreen />;
}
