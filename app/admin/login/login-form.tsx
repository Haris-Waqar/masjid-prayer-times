"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { getSignInErrorMessage } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ) {
        setMessage(
          "Sign-in is not configured. Contact the site administrator.",
        );
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage(getSignInErrorMessage(error));
        return;
      }

      // The /admin page verifies authorization server-side and redirects to
      // password setup when required, so we go straight there instead of
      // paying for a separate access-status round-trip before navigating.
      router.replace("/admin");
    } catch (error) {
      setMessage(getSignInErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="admin-email">Authorized email</label>
      <input
        id="admin-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@email.com"
      />
      <label htmlFor="admin-password">Password</label>
      <input
        id="admin-password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Your password"
      />
      <button className="primary-button" disabled={busy} type="submit">
        <LogIn size={18} /> {busy ? "Signing in…" : "Sign in"}
      </button>
      <Link className="form-link" href="/admin/forgot-password">
        Forgot password?
      </Link>
      {message && (
        <p className="form-message error" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
