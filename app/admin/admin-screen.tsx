"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LockKeyhole, Settings } from "lucide-react";
import { AdminEditor } from "@/app/admin/admin-editor";
import {
  clearCachedBootstrap,
  getCachedBootstrap,
  setCachedBootstrap,
} from "@/app/admin/bootstrap-cache";
import { SignOutButton } from "@/app/admin/sign-out-button";
import { NavigationPendingIcon } from "@/app/navigation-pending-icon";
import { readApiResponse } from "@/lib/api-response";
import type { PrayerTime } from "@/lib/prayers";

const CACHE_KEY = "admin";

type Ready = {
  state: "ready";
  email: string;
  canManage: boolean;
  date: string;
  times: PrayerTime[];
};

function editorBootstrapKey(ready: Ready): string {
  return [
    ready.email,
    ready.date,
    ...ready.times.map((time) => `${time.prayer}:${time.jamaat}`),
  ].join("|");
}

type Status =
  | { state: "loading" }
  | { state: "denied" }
  | { state: "error"; message: string }
  | Ready;

type AccessStatus = {
  error?: string;
  ok?: boolean;
  email?: string;
  canEdit?: boolean;
  canManage?: boolean;
  passwordSetupRequired?: boolean;
};

type ScheduleResponse = {
  error?: string;
  date?: string;
  times?: PrayerTime[];
};

export function AdminScreen() {
  // Seed from the session cache so a revisit renders the last data instantly;
  // the effect below still refreshes it in the background.
  const [status, setStatus] = useState<Status>(
    () => getCachedBootstrap<Ready>(CACHE_KEY) ?? { state: "loading" },
  );

  useEffect(() => {
    // Once per mount. next/navigation's useRouter() is a new object whenever
    // the router cache changes, and depending on it restarts this load during
    // sign-in — the skeleton never settles, and the repeated Auth calls pile up.
    const controller = new AbortController();
    let active = true;

    async function bootstrap() {
      try {
        const [accessResponse, scheduleResponse] = await Promise.all([
          fetch("/api/admin/access-status", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/admin/schedule", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        if (!active) return;

        if (accessResponse.status === 401) {
          clearCachedBootstrap(CACHE_KEY);
          window.location.replace("/admin/login");
          return;
        }

        const access = await readApiResponse<AccessStatus>(accessResponse);
        if (accessResponse.status === 403 || !access.ok) {
          clearCachedBootstrap(CACHE_KEY);
          setStatus({ state: "denied" });
          return;
        }
        if (access.passwordSetupRequired) {
          clearCachedBootstrap(CACHE_KEY);
          window.location.replace("/admin/reset-password?setup=required");
          return;
        }
        if (!access.canEdit) {
          clearCachedBootstrap(CACHE_KEY);
          setStatus({ state: "denied" });
          return;
        }

        const accessEmail = access.email ?? "";
        // Drop a prior admin's cached shell before the schedule finishes so a
        // same-tab re-login never keeps showing their editor.
        setStatus((prev) =>
          prev.state === "ready" && prev.email !== accessEmail
            ? { state: "loading" }
            : prev,
        );
        if (getCachedBootstrap<Ready>(CACHE_KEY)?.email !== accessEmail) {
          clearCachedBootstrap(CACHE_KEY);
        }

        const schedule =
          await readApiResponse<ScheduleResponse>(scheduleResponse);
        if (!scheduleResponse.ok || !schedule.date || !schedule.times) {
          // Don't replace a good cached view with an error on a transient
          // background refresh failure — but only when it belongs to this user.
          setStatus((prev) =>
            prev.state === "ready" && prev.email === accessEmail
              ? prev
              : {
                  state: "error",
                  message:
                    schedule.error ??
                    "The timetable could not be loaded. Try again.",
                },
          );
          return;
        }

        const ready: Ready = {
          state: "ready",
          email: accessEmail,
          canManage: access.canManage ?? false,
          date: schedule.date,
          times: schedule.times,
        };
        setCachedBootstrap(CACHE_KEY, ready);
        setStatus(ready);
      } catch {
        if (!active || controller.signal.aborted) return;
        setStatus((prev) =>
          prev.state === "ready"
            ? prev
            : {
                state: "error",
                message: "The timetable could not be loaded. Try again.",
              },
        );
      }
    }

    void bootstrap();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  if (status.state === "denied") {
    return (
      <main className="admin-shell">
        <div className="admin-topbar">
          <Link className="back-link" href="/">
            <NavigationPendingIcon kind="back" size={17} /> Back to jamaat times
          </Link>
          <SignOutButton />
        </div>
        <section className="access-denied">
          <LockKeyhole size={28} aria-hidden="true" />
          <h1 className="admin-title">Access is restricted</h1>
          <p className="admin-lede">
            This signed-in account is not on the active administrator list.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <div className="admin-topbar">
        <Link className="back-link" href="/">
          <NavigationPendingIcon kind="back" size={17} /> Back to jamaat times
        </Link>
        <div className="admin-topbar-actions">
          {status.state === "ready" && status.canManage ? (
            <Link className="back-link" href="/admin/manage">
              <Settings size={17} aria-hidden="true" /> Manage
            </Link>
          ) : null}
          <SignOutButton />
        </div>
      </div>
      <h1 className="admin-title">Update jamaat times</h1>
      <p className="admin-lede">
        Review every time before posting. People are notified only when a jamaat
        time actually changes.
      </p>
      {status.state === "ready" ? (
        <AdminEditor
          key={editorBootstrapKey(status)}
          initialDate={status.date}
          initialTimes={status.times}
          editorEmail={status.email}
        />
      ) : status.state === "error" ? (
        <p className="form-message error" role="alert">
          {status.message}
        </p>
      ) : (
        <div className="editor-skeleton" aria-busy="true" aria-live="polite">
          <span className="skeleton skeleton-line" style={{ width: "40%" }} />
          <span className="skeleton skeleton-block" />
          <span className="sr-only">Loading timetable…</span>
        </div>
      )}
    </main>
  );
}
