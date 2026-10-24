"use client";

import { useState } from "react";
import { BellRing, Save } from "lucide-react";
import { PRAYERS, type PrayerTime } from "@/lib/prayers";

type Props = {
  initialDate: string;
  initialTimes: PrayerTime[];
  editorEmail: string;
};

export function AdminEditor({ initialDate, initialTimes, editorEmail }: Props) {
  const [date, setDate] = useState(initialDate);
  const [times, setTimes] = useState(initialTimes);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );

  function updateTime(index: number, field: "prayerStart" | "jamaat", value: string) {
    setTimes((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  async function save() {
    const changeSummary = times
      .map((item) => `${item.prayer}: ${item.jamaat}`)
      .join("\n");
    if (!window.confirm(`Publish these jamaat times for ${date}?\n\n${changeSummary}`)) {
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, times }),
      });
      const result = (await response.json()) as {
        error?: string;
        changed?: number;
        notified?: number;
      };
      if (!response.ok) throw new Error(result.error || "The timetable could not be saved.");
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
        <span>Begins</span>
        <span>Jamaat</span>
      </div>
      {PRAYERS.map((prayer, index) => (
        <div className="admin-prayer-row" key={prayer}>
          <strong>{prayer}</strong>
          <div className="time-field">
            <label htmlFor={`${prayer}-start`}>Prayer begins</label>
            <input
              id={`${prayer}-start`}
              type="time"
              value={times[index].prayerStart}
              onChange={(event) => updateTime(index, "prayerStart", event.target.value)}
            />
          </div>
          <div className="time-field">
            <label htmlFor={`${prayer}-jamaat`}>Jamaat</label>
            <input
              id={`${prayer}-jamaat`}
              type="time"
              value={times[index].jamaat}
              onChange={(event) => updateTime(index, "jamaat", event.target.value)}
            />
          </div>
        </div>
      ))}

      <button className="primary-button" type="button" onClick={save} disabled={saving}>
        {saving ? <BellRing size={18} /> : <Save size={18} />}
        {saving ? "Publishing…" : "Review and publish"}
      </button>
      <p className="updated-note">Signed in as {editorEmail}</p>
      {message && <p className={`form-message ${message.kind}`}>{message.text}</p>}
    </section>
  );
}
