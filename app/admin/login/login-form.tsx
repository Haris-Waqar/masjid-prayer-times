"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
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
        throw new Error("Supabase setup is not complete yet.");
      }
      const { error } = await createClient().auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw new Error("The email or password is incorrect.");
      router.replace("/admin");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
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
        placeholder="imam@example.org"
      />
      <label htmlFor="admin-password">Password</label>
      <input
        id="admin-password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button className="primary-button" disabled={busy} type="submit">
        <LogIn size={18} /> {busy ? "Signing in…" : "Sign in"}
      </button>
      <Link className="form-link" href="/admin/forgot-password">
        Forgot password?
      </Link>
      {message && <p className="form-message error">{message}</p>}
    </form>
  );
}
