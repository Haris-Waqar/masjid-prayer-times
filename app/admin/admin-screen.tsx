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
import type { AdminMosque } from "@/lib/admin-policy";
import { mosquePublicPath } from "@/lib/mosques";
import type { PrayerTime } from "@/lib/prayers";

const CACHE_KEY = "admin";

type Ready = {
  state: "ready";
  email: string;
  canManageAdmins: boolean;
  canManageMasjids: boolean;
  mosques: AdminMosque[];
  mosque: AdminMosque;
  date: string;
  times: PrayerTime[];
};

function editorBootstrapKey(ready: Ready): string {
  return [
    ready.email,
    ready.mosque.id,
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
  canManageMasjids?: boolean;
  mosques?: AdminMosque[];
  passwordSetupRequired?: boolean;
};

type ScheduleResponse = {
  error?: string;
  date?: string;
  times?: PrayerTime[];
  mosque?: AdminMosque;
};

type LoadedSchedule = {
  date: string;
  times: PrayerTime[];
  mosque?: AdminMosque;
};

async function loadSchedule(
  mosqueId: string,
  signal?: AbortSignal,
): Promise<LoadedSchedule> {
  const response = await fetch(
    `/api/admin/schedule?mosqueId=${encodeURIComponent(mosqueId)}`,
    { cache: "no-store", signal },
  );
  const schedule = await readApiResponse<ScheduleResponse>(response);
  if (!response.ok || !schedule.date || !schedule.times) {
    throw new Error(
      schedule.error ?? "The selected timetable could not be loaded.",
    );
  }
  return {
    date: schedule.date,
    times: schedule.times,
    mosque: schedule.mosque,
  };
}

export function AdminScreen() {
  const [status, setStatus] = useState<Status>(
    () => getCachedBootstrap<Ready>(CACHE_KEY) ?? { state: "loading" },
  );
  const [switchingMosque, setSwitchingMosque] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
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
        if (accessResponse.status === 403) {
          clearCachedBootstrap(CACHE_KEY);
          setStatus({ state: "denied" });
          return;
        }
        if (!accessResponse.ok || !access.ok) {
          clearCachedBootstrap(CACHE_KEY);
          setStatus({
            state: "error",
            message:
              access.error ??
              "Administrator access could not be verified. Try again.",
          });
          return;
        }
        if (access.passwordSetupRequired) {
          clearCachedBootstrap(CACHE_KEY);
          window.location.replace("/admin/reset-password?setup=required");
          return;
        }

        const mosques = access.mosques ?? [];
        if (!access.canEdit) {
          clearCachedBootstrap(CACHE_KEY);
          setStatus({ state: "denied" });
          return;
        }
        if (mosques.length === 0) {
          clearCachedBootstrap(CACHE_KEY);
          setStatus({
            state: "error",
            message:
              "No active masjids are available. Create or restore a masjid before editing its timetable.",
          });
          return;
        }

        const accessEmail = access.email ?? "";
        const cached = getCachedBootstrap<Ready>(CACHE_KEY);
        if (cached?.email !== accessEmail) clearCachedBootstrap(CACHE_KEY);
        const selectedMosque =
          mosques.find((mosque) => mosque.id === cached?.mosque.id) ?? mosques[0];
        const schedule = await loadSchedule(selectedMosque.id, controller.signal);
        if (!active) return;

        const ready: Ready = {
          state: "ready",
          email: accessEmail,
          canManageAdmins: access.canManage ?? false,
          canManageMasjids: access.canManageMasjids ?? false,
          mosques,
          mosque: schedule.mosque ?? selectedMosque,
          date: schedule.date,
          times: schedule.times,
        };
        setCachedBootstrap(CACHE_KEY, ready);
        setStatus(ready);
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setStatus((previous) =>
          previous.state === "ready"
            ? previous
            : {
                state: "error",
                message:
                  error instanceof Error
                    ? error.message
                    : "The timetable could not be loaded. Try again.",
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

  async function changeMosque(mosqueId: string) {
    if (status.state !== "ready" || status.mosque.id === mosqueId) return;
    const mosque = status.mosques.find((item) => item.id === mosqueId);
    if (!mosque) return;

    setSwitchingMosque(true);
    setSwitchError(null);
    try {
      const schedule = await loadSchedule(mosque.id);
      const ready: Ready = {
        ...status,
        mosque: schedule.mosque ?? mosque,
        date: schedule.date,
        times: schedule.times,
      };
      setCachedBootstrap(CACHE_KEY, ready);
      setStatus(ready);
    } catch (error) {
      setSwitchError(
        error instanceof Error
          ? error.message
          : "The selected timetable could not be loaded.",
      );
    } finally {
      setSwitchingMosque(false);
    }
  }

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
            This signed-in account has no active masjid assignment.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <div className="admin-topbar">
        <Link
          className="back-link"
          href={
            status.state === "ready"
              ? mosquePublicPath(status.mosque.slug)
              : "/"
          }
        >
          <NavigationPendingIcon kind="back" size={17} /> Back to jamaat times
        </Link>
        <div className="admin-topbar-actions">
          {status.state === "ready" && status.canManageMasjids ? (
            <Link className="back-link" href="/admin/masjids">
              <Settings size={17} aria-hidden="true" /> Manage masjids
            </Link>
          ) : null}
          {status.state === "ready" && status.canManageAdmins ? (
            <Link className="back-link" href="/admin/manage">
              <Settings size={17} aria-hidden="true" /> Manage admins
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
        <>
          {status.mosques.length > 1 ? (
            <div className="admin-mosque-picker">
              <label htmlFor="admin-mosque">Masjid to update</label>
              <select
                id="admin-mosque"
                value={status.mosque.id}
                disabled={switchingMosque}
                onChange={(event) => void changeMosque(event.target.value)}
              >
                {status.mosques.map((mosque) => (
                  <option key={mosque.id} value={mosque.id}>
                    {mosque.name}
                  </option>
                ))}
              </select>
              {switchingMosque ? (
                <span role="status">Loading timetable…</span>
              ) : null}
              {switchError ? (
                <span className="field-error" role="alert">
                  {switchError}
                </span>
              ) : null}
            </div>
          ) : null}
          <AdminEditor
            key={editorBootstrapKey(status)}
            mosqueId={status.mosque.id}
            mosqueName={status.mosque.name}
            initialDate={status.date}
            initialTimes={status.times}
            editorEmail={status.email}
          />
        </>
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
