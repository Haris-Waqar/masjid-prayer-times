"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  Check,
  Clipboard,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { Modal } from "@/app/components/modal";
import type { AdminOverview, SafeAdmin } from "@/lib/admin-management";
import { readApiResponse } from "@/lib/api-response";

type CreatedCredential = { email: string; temporaryPassword: string };
type Message = { kind: "success" | "error"; text: string };

function formatDate(value: string | null) {
  if (!value) return "No changes recorded";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  }).format(new Date(value));
}

export function ManagementDashboard({
  initialOverview,
}: {
  initialOverview: AdminOverview;
}) {
  const emailInput = useRef<HTMLInputElement>(null);
  const [overview, setOverview] = useState(initialOverview);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [credential, setCredential] = useState<CreatedCredential | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState<SafeAdmin | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [accessBusyId, setAccessBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  async function refreshOverview() {
    const response = await fetch("/api/admin/overview", { cache: "no-store" });
    const result = await readApiResponse<AdminOverview & { error?: string }>(
      response,
    );
    if (!response.ok)
      throw new Error(result.error ?? "The overview could not be refreshed.");
    setOverview(result);
  }

  async function refreshDashboard() {
    setRefreshing(true);
    setMessage(null);
    try {
      await refreshOverview();
      setMessage({ kind: "success", text: "Dashboard data refreshed." });
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "The dashboard could not be refreshed.",
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function changeAccess(admin: SafeAdmin) {
    const active = !admin.active;
    setAccessBusyId(admin.id);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/admins/${encodeURIComponent(admin.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ active }),
        },
      );
      const result = await readApiResponse<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(
          result.error ?? "Administrator access could not be updated.",
        );
      }
      await refreshOverview();
      setMessage({
        kind: "success",
        text: `${admin.email} access was ${active ? "activated" : "revoked"}.`,
      });
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Administrator access could not be updated.",
      });
    } finally {
      setAccessBusyId(null);
    }
  }

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailInput.current?.checkValidity()) {
      setEmailError("Enter a valid email address.");
      emailInput.current?.reportValidity();
      return;
    }
    setCreating(true);
    setEmailError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await readApiResponse<
        CreatedCredential & { error?: string }
      >(response);
      if (!response.ok || !result.temporaryPassword)
        throw new Error(
          result.error ?? "The administrator could not be created.",
        );
      setCredential({
        email: result.email,
        temporaryPassword: result.temporaryPassword,
      });
      setEmail("");
      setCopied(false);
      setShowPassword(false);
      await refreshOverview();
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "The administrator could not be created.",
      });
    } finally {
      setCreating(false);
    }
  }

  async function copyPassword() {
    if (!credential) return;
    try {
      await navigator.clipboard.writeText(credential.temporaryPassword);
      setCopied(true);
    } catch {
      setMessage({
        kind: "error",
        text: "Copy was blocked. Select the password and copy it manually.",
      });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/admins/${encodeURIComponent(deleting.id)}`,
        { method: "DELETE" },
      );
      const result = await readApiResponse<{ error?: string }>(response);
      if (!response.ok)
        throw new Error(
          result.error ?? "The administrator could not be deleted.",
        );
      const deletedEmail = deleting.email;
      setDeleting(null);
      await refreshOverview();
      setMessage({
        kind: "success",
        text: `${deletedEmail} was permanently removed.`,
      });
      requestAnimationFrame(() => emailInput.current?.focus());
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "The administrator could not be deleted.",
      });
    } finally {
      setDeleteBusy(false);
    }
  }

  const stats = overview.statistics;
  const cards = [
    ["Subscribed devices", stats.totalDevices],
    ["English / Urdu", `${stats.englishDevices} / ${stats.urduDevices}`],
    ["New in 30 days", stats.devicesCreatedLast30Days],
    ["Registered or refreshed in 30 days", stats.devicesRefreshedLast30Days],
    ["Active administrators", stats.activeAdmins],
    ["Timetable changes in 30 days", stats.timetableChangesLast30Days],
  ] as const;

  return (
    <div className="management-stack">
      <section aria-labelledby="statistics-heading">
        <div className="management-heading">
          <div>
            <p className="section-kicker">Operations</p>
            <h2 id="statistics-heading">At a glance</h2>
          </div>
          <div className="management-heading-actions">
            <p className="last-updated">
              Updated {formatDate(stats.updatedAt)}
            </p>
            <button
              className="refresh-button management-refresh-button"
              type="button"
              onClick={refreshDashboard}
              disabled={refreshing}
              aria-label={
                refreshing
                  ? "Refreshing dashboard data"
                  : "Refresh dashboard data"
              }
            >
              <RefreshCw
                className={refreshing ? "is-spinning" : undefined}
                size={18}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
        <div className="statistics-grid">
          {cards.map(([label, value]) => (
            <article className="stat-card" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>
        <p className="statistics-note">
          Device registrations are operational counters. A recent refresh does
          not prove notification delivery or user activity.
        </p>
        <p className="latest-change">
          Latest timetable change:{" "}
          <strong>{formatDate(stats.latestTimetableChange)}</strong>
        </p>
      </section>

      <section className="admin-card" aria-labelledby="administrators-heading">
        <div className="management-heading">
          <div>
            <p className="section-kicker">Access</p>
            <h2 id="administrators-heading">Administrators</h2>
          </div>
        </div>
        <form className="admin-create-form" onSubmit={createAdmin} noValidate>
          <label htmlFor="new-admin-email">New administrator email</label>
          <div className="admin-create-controls">
            <input
              ref={emailInput}
              id="new-admin-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              value={email}
              aria-describedby={
                emailError ? "new-admin-email-error" : undefined
              }
              aria-invalid={Boolean(emailError)}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailError(null);
              }}
              disabled={creating}
            />
            <button
              className="primary-button"
              type="submit"
              disabled={creating}
            >
              <Plus size={18} aria-hidden="true" />{" "}
              {creating ? "Creating…" : "Add admin"}
            </button>
          </div>
          {emailError ? (
            <span
              id="new-admin-email-error"
              className="field-error"
              role="alert"
            >
              {emailError}
            </span>
          ) : null}
          <small>A temporary password will be generated and shown once.</small>
        </form>
        <ul className="admin-member-list">
          {overview.admins.map((admin) => (
            <li key={admin.id}>
              <div>
                <strong>{admin.email}</strong>
                <span>
                  {admin.role === "super_admin"
                    ? "Super administrator"
                    : "Administrator"}
                </span>
                {admin.role === "admin" ? (
                  <span className="admin-access-state">
                    {admin.active ? "Access active" : "Access revoked"}
                  </span>
                ) : null}
              </div>
              {admin.role === "admin" ? (
                <div className="admin-member-actions">
                  <button
                    className="secondary-button access-button"
                    type="button"
                    disabled={accessBusyId === admin.id}
                    onClick={() => changeAccess(admin)}
                  >
                    {admin.active ? (
                      <ShieldOff size={17} aria-hidden="true" />
                    ) : (
                      <ShieldCheck size={17} aria-hidden="true" />
                    )}
                    {accessBusyId === admin.id
                      ? "Updating…"
                      : admin.active
                        ? "Revoke access"
                        : "Activate access"}
                  </button>
                  <button
                    className="icon-danger-button"
                    type="button"
                    onClick={() => setDeleting(admin)}
                    aria-label={`Delete administrator ${admin.email}`}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <span className="read-only-badge">Protected</span>
              )}
            </li>
          ))}
        </ul>
        <div className="management-message" aria-live="polite">
          {message ? (
            <p
              className={`form-message ${message.kind}`}
              role={message.kind === "error" ? "alert" : "status"}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      </section>

      <Modal
        open={Boolean(credential)}
        title="Save the temporary password"
        kicker="Shown once"
        onClose={() => setCredential(null)}
        closeLabel="Close temporary password dialog"
        actions={
          <button
            className="primary-button"
            type="button"
            onClick={() => setCredential(null)}
          >
            I have saved it
          </button>
        }
      >
        <p className="dialog-copy">
          Share this password securely with <strong>{credential?.email}</strong>
          . It cannot be shown again, and they must replace it at first sign-in.
        </p>
        <label
          className="temporary-password-label"
          htmlFor="temporary-password"
        >
          Temporary password
        </label>
        <div className="temporary-password-control">
          <input
            id="temporary-password"
            autoFocus
            readOnly
            type={showPassword ? "text" : "password"}
            value={credential?.temporaryPassword ?? ""}
          />
          <button
            type="button"
            className="dialog-tool-button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={
              showPassword
                ? "Hide temporary password"
                : "Show temporary password"
            }
          >
            {showPassword ? (
              <EyeOff size={18} aria-hidden="true" />
            ) : (
              <Eye size={18} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="dialog-tool-button"
            onClick={copyPassword}
            aria-label="Copy temporary password"
          >
            {copied ? (
              <Check size={18} aria-hidden="true" />
            ) : (
              <Clipboard size={18} aria-hidden="true" />
            )}
          </button>
        </div>
        <p className="copy-status" role="status" aria-live="polite">
          {copied
            ? "Copied to clipboard."
            : "Copy or securely record the password before closing."}
        </p>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        title="Permanently delete administrator?"
        kicker="Destructive action"
        onClose={() => !deleteBusy && setDeleting(null)}
        dismissible={!deleteBusy}
        actions={
          <>
            <button
              className="secondary-button"
              type="button"
              disabled={deleteBusy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={deleteBusy}
              onClick={confirmDelete}
            >
              {deleteBusy ? "Deleting…" : "Delete permanently"}
            </button>
          </>
        }
      >
        <p className="dialog-copy">
          <strong>{deleting?.email}</strong> will immediately lose administrator
          access. Their timetable history will remain.
        </p>
      </Modal>
    </div>
  );
}
