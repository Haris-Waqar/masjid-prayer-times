import { AdminScreen } from "@/app/admin/admin-screen";

// Rendered as a static client shell so navigating here is instant (no server
// round-trip). Authorization and data are fetched client-side via the admin
// API routes, which enforce access themselves.
export default function AdminPage() {
  return <AdminScreen />;
}
