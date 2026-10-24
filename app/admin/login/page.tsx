import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "@/app/admin/login/login-form";

export default function AdminLoginPage() {
  return (
    <main className="admin-shell">
      <div className="admin-topbar">
        <Link className="back-link" href="/">
          <ArrowLeft size={17} /> Back to timetable
        </Link>
      </div>
      <section className="admin-card login-card">
        <h1 className="admin-title">Imam and editor sign in</h1>
        <p className="admin-lede">
          Enter an authorized email address. We will send a secure sign-in link—no
          password is needed.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
