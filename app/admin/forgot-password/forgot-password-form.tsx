"use client";

import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
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
      const redirectTo = `${window.location.origin}/auth/callback?next=/admin/reset-password`;
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;
      setMessage({
        kind: "success",
        text: "If this address has an editor account, a reset link has been sent.",
      });
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof Error && /rate limit/i.test(error.message)
            ? "Too many emails have been requested. Please try again later."
            : "The reset email could not be sent. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="recovery-email">Authorized email</label>
      <input
        id="recovery-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="imam@example.org"
      />
      <button className="primary-button" disabled={busy} type="submit">
        <Mail size={18} /> {busy ? "Sending…" : "Send reset link"}
      </button>
      {message && <p className={`form-message ${message.kind}`}>{message.text}</p>}
    </form>
  );
}
