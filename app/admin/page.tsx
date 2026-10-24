import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { AdminEditor } from "@/app/admin/admin-editor";
import { SignOutButton } from "@/app/admin/sign-out-button";
import { NavigationPendingIcon } from "@/app/navigation-pending-icon";
import { dateInTimezone } from "@/lib/prayers";
import { getPrayerTimes, getSettings } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    redirect("/admin/login?setup=required");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: admin } = await supabase
    .from("admin_members")
    .select("id")
    .eq("email", user.email?.toLowerCase() ?? "")
    .eq("active", true)
    .maybeSingle();

  if (!admin) {
    return (
      <main className="admin-shell">
        <div className="admin-topbar">
          <Link className="back-link" href="/">
            <NavigationPendingIcon kind="back" size={17} /> Back to timetable
          </Link>
          <SignOutButton />
        </div>
        <section className="access-denied">
          <LockKeyhole size={28} aria-hidden="true" />
          <h1 className="admin-title">Editor access is restricted</h1>
          <p className="admin-lede">
            You signed in as <strong>{user.email}</strong>, but this address is not
            on the mosque administrator list.
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
          <NavigationPendingIcon kind="back" size={17} /> Back to timetable
        </Link>
        <SignOutButton />
      </div>
      <h1 className="admin-title">Update the timetable</h1>
      <p className="admin-lede">
        Review every time before publishing. Subscribers are notified only when a
        jamaat time actually changes.
      </p>
      <AdminEditor initialDate={date} initialTimes={times} editorEmail={user.email!} />
    </main>
  );
}
