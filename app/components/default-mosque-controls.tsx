"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DefaultButtonProps = {
  slug: string;
  mosqueName: string;
  isDefault?: boolean;
  redirectTo?: string;
  className?: string;
};

type ApiResult = { ok?: boolean; error?: string };

export function DefaultMosqueButton({
  slug,
  mosqueName,
  isDefault = false,
  redirectTo,
  className = "secondary-button",
}: DefaultButtonProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(isDefault);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  async function saveDefault() {
    setState("saving");
    setMessage("");
    try {
      const response = await fetch("/api/preferences/default-masjid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const result = (await response.json()) as ApiResult;
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Your default masjid could not be saved.");
      }

      setSaved(true);
      setState("idle");
      setMessage(`${mosqueName} is now your default masjid.`);
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Your default masjid could not be saved.",
      );
    }
  }

  return (
    <div className="default-mosque-control">
      <button
        type="button"
        className={className}
        onClick={saveDefault}
        disabled={saved || state === "saving"}
        aria-label={saved ? `${mosqueName} is your default masjid` : `Set ${mosqueName} as default`}
      >
        {saved ? "Default masjid" : state === "saving" ? "Saving…" : "Set as default"}
      </button>
      {message ? (
        <span
          className={state === "error" ? "preference-error" : "preference-status"}
          role={state === "error" ? "alert" : "status"}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}

export function StaleDefaultCleanup({ active }: { active: boolean }) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function clearStaleDefault() {
      try {
        const response = await fetch("/api/preferences/default-masjid", {
          method: "DELETE",
        });
        if (!response.ok) throw new Error();
        if (!cancelled) setMessage("Your unavailable saved masjid was cleared.");
      } catch {
        if (!cancelled) {
          setMessage("Your saved masjid could not be cleared. You can still choose another.");
        }
      }
    }

    void clearStaleDefault();
    return () => {
      cancelled = true;
    };
  }, [active]);

  return message ? (
    <p className="preference-cleanup-status" role="status">
      {message}
    </p>
  ) : null;
}
