"use client";

import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { readApiResponse } from "@/lib/api-response";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm({
  requiresSetup,
}: {
  requiresSetup: boolean;
}) {
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
      if (requiresSetup) {
        const response = await fetch("/api/admin/complete-setup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const result = await readApiResponse<{ error?: string }>(response);
        if (!response.ok)
          throw new Error(result.error ?? "The password could not be updated.");
        await createClient().auth.refreshSession();
      } else {
        const { error } = await createClient().auth.updateUser({ password });
        if (error) throw error;
      }
      window.location.replace("/admin");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The password could not be updated. Request a new reset link and try again.",
      );
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
      {message && (
        <p className="form-message error" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
