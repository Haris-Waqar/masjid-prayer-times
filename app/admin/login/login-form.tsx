"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { getSignInErrorMessage } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // The login route can be served from the client router cache, so the server
  // redirect may not run. Confirm the session with Auth before leaving: a
  // cookie-only check would send a rejected session straight back to /admin.
  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ) {
      return;
    }
    let active = true;
    void createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (active && user) window.location.replace("/admin");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

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
        setBusy(false);
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage(getSignInErrorMessage(error));
        setBusy(false);
        return;
      }

      // Full navigation so the new session cookie is sent once, and so this
      // page's server redirect cannot race a client-side replace + refresh.
      window.location.replace("/admin");
    } catch (error) {
      setMessage(getSignInErrorMessage(error));
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
