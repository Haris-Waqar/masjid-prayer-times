"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, CalendarDays, Clock3, Save } from "lucide-react";
import { Modal } from "@/app/components/modal";
import { readApiResponse } from "@/lib/api-response";
import { displayScheduleDate } from "@/lib/prayer-change-notification";
import {
  PRAYERS,
  havePrayerTimesChanged,
  type PrayerTime,
} from "@/lib/prayers";

type Props = {
  initialDate: string;
  initialTimes: PrayerTime[];
  editorEmail: string;
};

export function AdminEditor({ initialDate, initialTimes, editorEmail }: Props) {
  const timeInputs = useRef<Array<HTMLInputElement | null>>([]);
  const dateRequest = useRef<AbortController | null>(null);
  const [date, setDate] = useState(initialDate);
  const [loadedDate, setLoadedDate] = useState(initialDate);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [times, setTimes] = useState(initialTimes);
  const [publishedTimes, setPublishedTimes] = useState(initialTimes);
  const [loadingDate, setLoadingDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );
  const hasChanges = havePrayerTimesChanged(times, publishedTimes);

  useEffect(() => () => dateRequest.current?.abort(), []);

  function changeDate(nextDate: string) {
    if (!nextDate || nextDate === loadedDate) {
      setDate(loadedDate);
      return;
    }
    if (hasChanges) {
      setPendingDate(nextDate);
      return;
    }
    void loadDate(nextDate);
  }

  function keepEditing() {
    setPendingDate(null);
  }

  function discardChanges() {
    if (!pendingDate) return;
    const nextDate = pendingDate;
    setPendingDate(null);
    void loadDate(nextDate);
  }

  async function loadDate(nextDate: string) {
    dateRequest.current?.abort();
    const controller = new AbortController();
    dateRequest.current = controller;
    setDate(nextDate);
    setLoadingDate(true);
    setLoadError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/schedule?date=${encodeURIComponent(nextDate)}`,
        { signal: controller.signal },
      );
      const result = await readApiResponse<{ error?: string; times?: PrayerTime[] }>(response);
      if (!response.ok || !result.times) {
        throw new Error(result.error || "Jamaat times could not be loaded.");
      }
      if (dateRequest.current !== controller) return;

      setTimes(result.times);
      setPublishedTimes(result.times);
      setLoadedDate(nextDate);
    } catch (error) {
      if (controller.signal.aborted || dateRequest.current !== controller) return;
      setDate(loadedDate);
      setLoadError(
        error instanceof Error ? error.message : "Jamaat times could not be loaded.",
      );
    } finally {
      if (dateRequest.current === controller) setLoadingDate(false);
    }
  }

  function updateTime(index: number, value: string) {
    setTimes((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, jamaat: value } : item,
      ),
    );
  }

  function review() {
    setMessage(null);
    setReviewOpen(true);
  }

  function closeReview() {
    if (!saving) setReviewOpen(false);
  }

  function openTimePicker(index: number) {
    const input = timeInputs.current[index];
    if (!input) return;
    input.focus({ preventScroll: true });
    try {
      input.showPicker?.();
    } catch {
      // The focused native input remains usable when showPicker is unavailable.
    }
  }

  async function publish() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, times }),
      });
      const result = await readApiResponse<{
        error?: string;
        changed?: number;
        notified?: number;
      }>(response);
      if (!response.ok) throw new Error(result.error || "Jamaat times could not be saved.");
      setReviewOpen(false);
      setPublishedTimes(times);
      setMessage({
        kind: "success",
        text:
          result.changed === 0
            ? "Saved. No jamaat times changed, so no alert was sent."
            : `Posted ${result.changed} change${result.changed === 1 ? "" : "s"}. ${
                result.notified ?? 0
              } subscribed device${result.notified === 1 ? " was" : "s were"} notified.`,
      });
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Jamaat times could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-card" aria-busy={loadingDate || saving}>
      <div className="form-date">
        <label htmlFor="effective-date">Effective date</label>
        <input
          id="effective-date"
          type="date"
          min={initialDate}
          required
          value={pendingDate ?? date}
          onChange={(event) => void changeDate(event.target.value)}
          disabled={saving}
        />
        <small>Choose today or a future date. Existing times load automatically.</small>
        {loadingDate && <span role="status">Loading times…</span>}
        {loadError && (
          <span className="date-load-error" role="alert">
            {loadError}
          </span>
        )}
      </div>

      <div className="admin-grid-head" aria-hidden="true">
        <span>Prayer</span>
        <span>Jamaat</span>
      </div>
      {PRAYERS.map((prayer, index) => (
        <div className="admin-prayer-row" key={prayer}>
          <strong>{prayer}</strong>
          <div className="time-field">
            <label className="visually-hidden" htmlFor={`${prayer}-jamaat`}>
              {prayer} jamaat
            </label>
            <div className="time-field-control">
              <span className="time-field-display" aria-hidden="true">
                {formatTime(times[index].jamaat)}
              </span>
              <Clock3 className="time-field-icon" size={16} aria-hidden="true" />
              <input
                ref={(element) => {
                  timeInputs.current[index] = element;
                }}
                id={`${prayer}-jamaat`}
                className="time-field-input"
                type="time"
                value={times[index].jamaat}
                onChange={(event) => updateTime(index, event.target.value)}
                onClick={() => openTimePicker(index)}
                disabled={loadingDate || saving}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        className="primary-button"
        type="button"
        onClick={review}
        disabled={saving || loadingDate || !hasChanges}
      >
        <Save size={18} />
        {loadingDate
          ? "Loading times…"
          : hasChanges
            ? "Review and post"
            : "No changes to post"}
      </button>
      <p className="updated-note">Signed in as {editorEmail}</p>
      {message?.kind === "success" && (
        <p className="form-message success" role="status">
          {message.text}
        </p>
      )}

      <Modal
        open={pendingDate !== null}
        kicker="Unsaved changes"
        title="Discard these edits?"
        closeLabel="Keep editing"
        onClose={keepEditing}
        actions={
          <>
            <button className="secondary-button" type="button" onClick={keepEditing}>
              Keep editing
            </button>
            <button className="danger-button" type="button" onClick={discardChanges}>
              Discard changes
            </button>
          </>
        }
      >
        <p className="dialog-copy">
          Loading {pendingDate ? displayScheduleDate(pendingDate) : "another date"} replaces the
          jamaat times on this page. Those edits have not been posted.
        </p>
      </Modal>

      <Modal
        open={reviewOpen}
        kicker="Final check"
        title="Post these jamaat times?"
        closeLabel="Close review"
        dismissible={!saving}
        onClose={closeReview}
        actions={
          <>
            <button className="secondary-button" type="button" onClick={closeReview} disabled={saving}>
              Go back
            </button>
            <button className="primary-button" type="button" onClick={publish} disabled={saving}>
              {saving ? <BellRing className="is-spinning" size={18} /> : <Save size={18} />}
              {saving ? "Posting…" : "Post jamaat times"}
            </button>
          </>
        }
      >
        <p className="dialog-date">
          <CalendarDays size={17} aria-hidden="true" /> From {displayScheduleDate(date)}
        </p>
        <ol className="review-list">
          {times.map((item, index) => (
            <li key={item.prayer}>
              <span>{item.prayer}</span>
              <strong>{formatTime(item.jamaat)}</strong>
              {item.jamaat !== publishedTimes[index]?.jamaat && <small>Changed</small>}
            </li>
          ))}
        </ol>
        <p className="dialog-note">
          Alerts are sent only when a jamaat time changes, and they include this date.
        </p>
        {message?.kind === "error" && (
          <p className="form-message error" role="alert">
            {message.text}
          </p>
        )}
      </Modal>
    </section>
  );
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}
