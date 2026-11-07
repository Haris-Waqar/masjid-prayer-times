import { redirect } from "next/navigation";
import { MasjidManagementScreen } from "@/app/admin/masjids/masjid-management-screen";
import { getAdminSession } from "@/lib/admin";
import { canManageMasjids } from "@/lib/admin-policy";

export default async function ManageMasjidsPage() {
  const { user, access } = await getAdminSession();
  if (!user) redirect("/admin/login");
  if (access?.passwordSetupRequired) {
    redirect("/admin/reset-password?setup=required");
  }
  if (!canManageMasjids(access)) redirect("/admin");

  return <MasjidManagementScreen />;
}
