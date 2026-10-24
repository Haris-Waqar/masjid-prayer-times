"use client";

import { useRef, useState } from "react";
import { BellRing, CalendarDays, Save, X } from "lucide-react";
import { readApiResponse } from "@/lib/api-response";
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
  const reviewDialog = useRef<HTMLDialogElement>(null);
  const timeInputs = useRef<Array<HTMLInputElement | null>>([]);
  const [date, setDate] = useState(initialDate);
  const [times, setTimes] = useState(initialTimes);
  const [publishedTimes, setPublishedTimes] = useState(initialTimes);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );
  const hasChanges = havePrayerTimesChanged(times, publishedTimes);

  function updateTime(index: number, value: string) {
    setTimes((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, jamaat: value } : item,
      ),
    );
  }

  function review() {
    setMessage(null);
    reviewDialog.current?.showModal();
  }

  function closeReview() {
    if (!saving) reviewDialog.current?.close();
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
      if (!response.ok) throw new Error(result.error || "The timetable could not be saved.");
      reviewDialog.current?.close();
      setPublishedTimes(times);
      setMessage({
        kind: "success",
        text:
          result.changed === 0
            ? "Saved. No jamaat times changed, so no alert was sent."
            : `Published ${result.changed} change${result.changed === 1 ? "" : "s"}. ${
                result.notified ?? 0
              } subscribed device${result.notified === 1 ? " was" : "s were"} notified.`,
      });
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "The timetable could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-card">
      <div className="form-date">
        <label htmlFor="effective-date">Effective date</label>
        <input
          id="effective-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      <div className="admin-grid-head" aria-hidden="true">
        <span>Prayer</span>
        <span>Jamaat</span>
      </div>
      {PRAYERS.map((prayer, index) => (
        <div className="admin-prayer-row" key={prayer}>
          <strong>{prayer}</strong>
          <div className="time-field" onClick={() => openTimePicker(index)}>
            <label htmlFor={`${prayer}-jamaat`}>Jamaat</label>
            <input
              ref={(element) => {
                timeInputs.current[index] = element;
              }}
              id={`${prayer}-jamaat`}
              type="time"
              value={times[index].jamaat}
              onChange={(event) => updateTime(index, event.target.value)}
            />
          </div>
        </div>
      ))}

      <button
        className="primary-button"
        type="button"
        onClick={review}
        disabled={saving || !hasChanges}
      >
        <Save size={18} /> {hasChanges ? "Review and publish" : "No changes to publish"}
      </button>
      <p className="updated-note">Signed in as {editorEmail}</p>
      {message?.kind === "success" && (
        <p className="form-message success" role="status">
          {message.text}
        </p>
      )}

      <dialog
        className="publish-dialog"
        ref={reviewDialog}
        aria-labelledby="publish-dialog-title"
        onCancel={(event) => {
          if (saving) event.preventDefault();
        }}
      >
        <div className="dialog-heading">
          <div>
            <p className="section-kicker">Final check</p>
            <h2 id="publish-dialog-title">Publish this timetable?</h2>
          </div>
          <button
            className="dialog-close"
            type="button"
            onClick={closeReview}
            disabled={saving}
            aria-label="Close review"
          >
            <X size={20} />
          </button>
        </div>
        <p className="dialog-date">
          <CalendarDays size={17} aria-hidden="true" /> Effective {date}
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
          Subscribers receive an alert only when a jamaat time has changed.
        </p>
        {message?.kind === "error" && (
          <p className="form-message error" role="alert">
            {message.text}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={closeReview}
            disabled={saving}
          >
            Go back
          </button>
          <button className="primary-button" type="button" onClick={publish} disabled={saving}>
            {saving ? <BellRing className="is-spinning" size={18} /> : <Save size={18} />}
            {saving ? "Publishing…" : "Publish timetable"}
          </button>
        </div>
      </dialog>
    </section>
  );
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}
