"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  clearCachedBootstrap,
  getCachedBootstrap,
  setCachedBootstrap,
} from "@/app/admin/bootstrap-cache";
import { ManagementDashboard } from "@/app/admin/manage/_components/management-dashboard";
import { SignOutButton } from "@/app/admin/sign-out-button";
import { NavigationPendingIcon } from "@/app/navigation-pending-icon";
import { readApiResponse } from "@/lib/api-response";
import type { AdminOverview } from "@/lib/admin-management";

const CACHE_KEY = "manage";

type ReadyStatus = { state: "ready"; overview: AdminOverview };

type Status =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; overview: AdminOverview };

type AccessStatus = {
  ok?: boolean;
  canManage?: boolean;
  passwordSetupRequired?: boolean;
};

type OverviewResponse = AdminOverview & { error?: string; ok?: boolean };

export function ManageScreen() {
  const [status, setStatus] = useState<Status>(
    () => getCachedBootstrap<ReadyStatus>(CACHE_KEY) ?? { state: "loading" },
  );

  useEffect(() => {
    // Once per mount. See AdminScreen: depending on useRouter() restarts the
    // load whenever the router cache changes.
    const controller = new AbortController();
    let active = true;

    async function bootstrap() {
      try {
        const accessResponse = await fetch("/api/admin/access-status", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!active) return;

        if (accessResponse.status === 401) {
          clearCachedBootstrap(CACHE_KEY);
          window.location.replace("/admin/login");
          return;
        }
        const access = await readApiResponse<AccessStatus>(accessResponse);
        if (access.passwordSetupRequired) {
          clearCachedBootstrap(CACHE_KEY);
          window.location.replace("/admin/reset-password?setup=required");
          return;
        }
        if (!access.ok || !access.canManage) {
          clearCachedBootstrap(CACHE_KEY);
          window.location.replace("/admin");
          return;
        }

        const overviewResponse = await fetch("/api/admin/overview", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!active) return;
        const overview =
          await readApiResponse<OverviewResponse>(overviewResponse);
        if (!overviewResponse.ok) {
          setStatus((prev) =>
            prev.state === "ready"
              ? prev
              : {
                  state: "error",
                  message:
                    overview.error ??
                    "The management overview could not be loaded. Try again.",
                },
          );
          return;
        }
        const ready: ReadyStatus = { state: "ready", overview };
        setCachedBootstrap(CACHE_KEY, ready);
        setStatus(ready);
      } catch {
        if (!active || controller.signal.aborted) return;
        setStatus((prev) =>
          prev.state === "ready"
            ? prev
            : {
                state: "error",
                message:
                  "The management overview could not be loaded. Try again.",
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

  return (
    <main className="admin-shell management-shell">
      <div className="admin-topbar">
        <Link className="back-link" href="/admin">
          <NavigationPendingIcon kind="back" size={17} /> Back to timetable
        </Link>
        <SignOutButton />
      </div>
      <h1 className="admin-title">Manage administrators</h1>
      <p className="admin-lede">
        Add regular administrators, review notification registrations, and keep
        access limited to people who need it.
      </p>
      {status.state === "ready" ? (
        <ManagementDashboard initialOverview={status.overview} />
      ) : status.state === "error" ? (
        <p className="form-message error" role="alert">
          {status.message}
        </p>
      ) : (
        <div className="editor-skeleton" aria-busy="true" aria-live="polite">
          <span className="skeleton skeleton-line" style={{ width: "45%" }} />
          <span className="skeleton skeleton-block" />
          <span className="sr-only">Loading administrators…</span>
        </div>
      )}
    </main>
  );
}
