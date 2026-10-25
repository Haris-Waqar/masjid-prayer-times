"use client";

import { useState } from "react";
import { clearAllCachedBootstrap } from "@/app/admin/bootstrap-cache";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await createClient().auth.signOut();
      clearAllCachedBootstrap();
      router.replace("/");
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      className="sign-out-button"
      type="button"
      onClick={signOut}
      disabled={busy}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
