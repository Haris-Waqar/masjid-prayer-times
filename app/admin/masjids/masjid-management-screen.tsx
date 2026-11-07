"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Archive, Plus, RotateCcw, Save } from "lucide-react";
import { NavigationPendingIcon } from "@/app/navigation-pending-icon";
import { SignOutButton } from "@/app/admin/sign-out-button";
import { readApiResponse } from "@/lib/api-response";
import {
  normalizeMosqueSlug,
  type CreateMosqueInput,
  type Mosque,
} from "@/lib/mosques";

type Message = { kind: "success" | "error"; text: string };
type MosqueResponse = { ok?: boolean; mosque?: Mosque; error?: string };
type ListResponse = { ok?: boolean; mosques?: Mosque[]; error?: string };

const EMPTY_FORM: CreateMosqueInput = {
  slug: "",
  name: "",
  location: "",
  timezone: "Asia/Karachi",
};

export function MasjidManagementScreen() {
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const loadMosques = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/admin/masjids", {
      cache: "no-store",
      signal,
    });
    const result = await readApiResponse<ListResponse>(response);
    if (!response.ok || !result.mosques) {
      throw new Error(result.error ?? "Masjids could not be loaded.");
    }
    return result.mosques;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function bootstrap() {
      try {
        setMosques(await loadMosques(controller.signal));
      } catch (error) {
        if (controller.signal.aborted) return;
        setMessage({
          kind: "error",
          text:
            error instanceof Error
              ? error.message
              : "Masjids could not be loaded.",
        });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void bootstrap();
    return () => controller.abort();
  }, [loadMosques]);

  async function createMosque(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/masjids", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await readApiResponse<MosqueResponse>(response);
      if (!response.ok || !result.mosque) {
        throw new Error(result.error ?? "The masjid could not be added.");
      }
      setForm(EMPTY_FORM);
      setMosques(await loadMosques());
      setMessage({ kind: "success", text: `${result.mosque.name} was added.` });
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "The masjid could not be added.",
      });
    } finally {
      setCreating(false);
    }
  }

  async function updateMosque(
    event: FormEvent<HTMLFormElement>,
    mosque: Mosque,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusyId(mosque.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/masjids/${mosque.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          location: data.get("location"),
          timezone: data.get("timezone"),
        }),
      });
      const result = await readApiResponse<MosqueResponse>(response);
      if (!response.ok || !result.mosque) {
        throw new Error(result.error ?? "The masjid could not be updated.");
      }
      setMosques(await loadMosques());
      setMessage({ kind: "success", text: `${result.mosque.name} was updated.` });
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "The masjid could not be updated.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function changeStatus(mosque: Mosque) {
    setBusyId(mosque.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/masjids/${mosque.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !mosque.active }),
      });
      const result = await readApiResponse<MosqueResponse>(response);
      if (!response.ok || !result.mosque) {
        throw new Error(result.error ?? "The masjid status could not be updated.");
      }
      setMosques(await loadMosques());
      setMessage({
        kind: "success",
        text: `${result.mosque.name} was ${result.mosque.active ? "restored" : "archived"}.`,
      });
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "The masjid status could not be updated.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="admin-shell management-shell">
      <div className="admin-topbar">
        <Link className="back-link" href="/admin">
          <NavigationPendingIcon kind="back" size={17} /> Back to timetable
        </Link>
        <SignOutButton />
      </div>
      <h1 className="admin-title">Manage masjids</h1>
      <p className="admin-lede">
        Add masjids, keep public details accurate, and archive locations without
        deleting their timetable history.
      </p>

      <section className="admin-card mosque-management-card" aria-labelledby="add-masjid-heading">
        <p className="section-kicker">New location</p>
        <h2 id="add-masjid-heading">Add a masjid</h2>
        <form className="mosque-form" onSubmit={createMosque}>
          <label htmlFor="new-mosque-name">Name</label>
          <input
            id="new-mosque-name"
            required
            maxLength={120}
            value={form.name}
            onChange={(event) => {
              const name = event.target.value;
              setForm((current) => ({
                ...current,
                name,
                slug: current.slug ? current.slug : normalizeMosqueSlug(name),
              }));
            }}
          />
          <label htmlFor="new-mosque-slug">Public URL name</label>
          <input
            id="new-mosque-slug"
            required
            maxLength={80}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            value={form.slug}
            onChange={(event) =>
              setForm((current) => ({ ...current, slug: normalizeMosqueSlug(event.target.value) }))
            }
            aria-describedby="new-mosque-slug-help"
          />
          <small id="new-mosque-slug-help">Used in the public link and cannot be changed later.</small>
          <label htmlFor="new-mosque-location">Location</label>
          <input
            id="new-mosque-location"
            required
            maxLength={240}
            value={form.location}
            onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
          />
          <label htmlFor="new-mosque-timezone">Timezone</label>
          <input
            id="new-mosque-timezone"
            required
            maxLength={80}
            value={form.timezone}
            onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
          />
          <button className="primary-button" type="submit" disabled={creating}>
            <Plus size={18} aria-hidden="true" /> {creating ? "Adding…" : "Add masjid"}
          </button>
        </form>
      </section>

      <section aria-labelledby="existing-masjids-heading">
        <div className="management-heading">
          <div>
            <p className="section-kicker">Directory</p>
            <h2 id="existing-masjids-heading">Existing masjids</h2>
          </div>
        </div>
        {loading ? (
          <p aria-live="polite">Loading masjids…</p>
        ) : (
          <div className="mosque-management-list">
            {mosques.map((mosque) => (
              <form
                className="admin-card mosque-form"
                key={mosque.id}
                onSubmit={(event) => void updateMosque(event, mosque)}
              >
                <div className="mosque-form-heading">
                  <div>
                    <strong>{mosque.slug}</strong>
                    <span className={mosque.active ? "read-only-badge" : "archived-badge"}>
                      {mosque.active ? "Active" : "Archived"}
                    </span>
                  </div>
                  <Link href={`/masjids/${mosque.slug}`}>View public page</Link>
                </div>
                <label htmlFor={`mosque-name-${mosque.id}`}>Name</label>
                <input id={`mosque-name-${mosque.id}`} name="name" required maxLength={120} defaultValue={mosque.name} />
                <label htmlFor={`mosque-location-${mosque.id}`}>Location</label>
                <input id={`mosque-location-${mosque.id}`} name="location" required maxLength={240} defaultValue={mosque.location} />
                <label htmlFor={`mosque-timezone-${mosque.id}`}>Timezone</label>
                <input id={`mosque-timezone-${mosque.id}`} name="timezone" required maxLength={80} defaultValue={mosque.timezone} />
                <div className="mosque-form-actions">
                  <button className="primary-button" type="submit" disabled={busyId === mosque.id}>
                    <Save size={17} aria-hidden="true" /> Save details
                  </button>
                  <button className="secondary-button" type="button" disabled={busyId === mosque.id} onClick={() => void changeStatus(mosque)}>
                    {mosque.active ? <Archive size={17} aria-hidden="true" /> : <RotateCcw size={17} aria-hidden="true" />}
                    {mosque.active ? "Archive" : "Restore"}
                  </button>
                </div>
              </form>
            ))}
          </div>
        )}
      </section>
      <div className="management-message" aria-live="polite">
        {message ? <p className={`form-message ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p> : null}
      </div>
    </main>
  );
}
