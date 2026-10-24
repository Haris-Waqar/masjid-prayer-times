"use client";

import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

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
      const redirectTo = `${window.location.origin}/auth/callback?next=/admin`;
      const { error } = await createClient().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });
      setMessage(
        error
          ? { kind: "error", text: error.message }
          : { kind: "success", text: "Check your email for the secure sign-in link." },
      );
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Sign-in could not be started.",
      });
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
      <button className="primary-button" disabled={busy} type="submit">
        <Mail size={18} /> {busy ? "Sending…" : "Email me a sign-in link"}
      </button>
      {message && <p className={`form-message ${message.kind}`}>{message.text}</p>}
    </form>
  );
}
