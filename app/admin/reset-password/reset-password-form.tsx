"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (password.length < 12) {
      setMessage("Use at least 12 characters.");
      return;
    }
    if (password !== confirmation) {
      setMessage("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      router.replace("/admin");
      router.refresh();
    } catch {
      setMessage("The password could not be updated. Request a new reset link and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="new-password">New password</label>
      <input
        id="new-password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <label htmlFor="confirm-password">Confirm new password</label>
      <input
        id="confirm-password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
      />
      <button className="primary-button" disabled={busy} type="submit">
        <KeyRound size={18} /> {busy ? "Updating…" : "Update password"}
      </button>
      {message && <p className="form-message error">{message}</p>}
    </form>
  );
}
