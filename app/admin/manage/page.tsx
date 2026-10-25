import { ManageScreen } from "@/app/admin/manage/manage-screen";

// Static client shell for instant navigation; authorization and the admin
// overview are fetched client-side via the admin API routes.
export default function ManageAdminsPage() {
  return <ManageScreen />;
}
