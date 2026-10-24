import Link from "next/link";
import { LoginForm } from "@/app/admin/login/login-form";
import { NavigationPendingIcon } from "@/app/navigation-pending-icon";

export default function AdminLoginPage() {
  return (
    <main className="admin-shell">
      <div className="admin-topbar">
        <Link className="back-link" href="/">
          <NavigationPendingIcon kind="back" size={17} /> Back to jamaat times
        </Link>
      </div>
      <section className="admin-card login-card">
        <h1 className="admin-title">Sign in</h1>
        <p className="admin-lede">
          Use your authorized email and password to manage jamaat times.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
