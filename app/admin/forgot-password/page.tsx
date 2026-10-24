import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ForgotPasswordForm } from "@/app/admin/forgot-password/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="admin-shell">
      <div className="admin-topbar">
        <Link className="back-link" href="/admin/login">
          <ArrowLeft size={17} /> Back to sign in
        </Link>
      </div>
      <section className="admin-card login-card">
        <h1 className="admin-title">Reset your password</h1>
        <p className="admin-lede">
          Enter your authorized email address and we will send a password-reset link.
        </p>
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
