"use client";

import { useState } from "react";
import { LoaderCircle, LogOut } from "lucide-react";
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
      aria-busy={busy}
    >
      {busy ? (
        <LoaderCircle className="is-spinning" size={17} aria-hidden="true" />
      ) : (
        <LogOut size={17} aria-hidden="true" />
      )}
      Sign out
    </button>
  );
}
