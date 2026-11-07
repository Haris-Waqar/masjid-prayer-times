"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  Clock,
  LockKeyhole,
  Search,
  X,
} from "lucide-react";
import {
  displayTime,
  findNextJamaat,
  minutesInTimezone,
  splitTime,
} from "@/lib/jamaat-time";
import { mosquePublicPath } from "@/lib/mosques";
import type { PrayerTime } from "@/lib/prayers";
import { PRAYER_URDU, remainingCopy } from "@/lib/ui-copy";

/** Public, serializable summary of one active masjid for the landing page. */
export type MasjidOption = {
  slug: string;
  name: string;
  location: string;
  timezone: string;
  /** True only when all five daily jamaat times are posted for today. */
  published: boolean;
  /** Today's five daily jamaat times; empty when not published. */
  times: PrayerTime[];
};

type Step = "find" | "preview" | "saved";
type SaveState = "idle" | "saving" | "error";
type ApiResult = { ok?: boolean; error?: string };

const DIAMONDS = Array.from({ length: 13 });
const TASSELS = Array.from({ length: 28 });

function RowArch() {
  return (
    <svg
      className="row-arch"
      width="14"
      height="18"
      viewBox="0 0 14 18"
      fill="none"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path d="M1 17V8a6 6 0 0 1 12 0v9z" />
    </svg>
  );
}

function matchesQuery(masjid: MasjidOption, needle: string) {
  return `${masjid.name} ${masjid.location}`.toLowerCase().includes(needle);
}

export function MasjidFinder({ masjids }: { masjids: MasjidOption[] }) {
  const [step, setStep] = useState<Step>("find");
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [now, setNow] = useState<Date | null>(null);

  const finderRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restoreSearchFocus = useRef(false);

  const inputId = useId();
  const listId = useId();
  const coverageId = useId();
  const todayHeadingId = useId();

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  // Close the list when the pointer goes elsewhere.
  useEffect(() => {
    if (!listOpen) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!finderRef.current?.contains(event.target as Node)) setListOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [listOpen]);

  // Move focus to the new step's heading, or back to the search field.
  useEffect(() => {
    if (step === "find") {
      if (restoreSearchFocus.current) {
        restoreSearchFocus.current = false;
        inputRef.current?.focus();
      }
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const sorted = useMemo(
    () => [...masjids].sort((left, right) => left.name.localeCompare(right.name)),
    [masjids],
  );
  const needle = query.trim().toLowerCase();
  const matches = needle ? sorted.filter((masjid) => matchesQuery(masjid, needle)) : sorted;

  const selected = masjids.find((masjid) => masjid.slug === selectedSlug) ?? null;
  const selectedNext =
    selected?.published && now
      ? findNextJamaat(selected.times, minutesInTimezone(selected.timezone, now))
      : null;

  function nextLabel(masjid: MasjidOption) {
    if (!masjid.published) return "Not posted today";
    if (!now) return "";
    const next = findNextJamaat(masjid.times, minutesInTimezone(masjid.timezone, now));
    return next ? `${next.prayer} ${displayTime(next.jamaat)}` : "";
  }

  function openList() {
    if (!listOpen) setListOpen(true);
  }

  function closeList() {
    setListOpen(false);
    setQuery("");
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && listOpen) {
      event.preventDefault();
      closeList();
      inputRef.current?.focus();
    }
  }

  function pick(slug: string) {
    setSelectedSlug(slug);
    setListOpen(false);
    setQuery("");
    setSaveState("idle");
    setSaveError("");
    setStep("preview");
  }

  function backToList() {
    restoreSearchFocus.current = true;
    setListOpen(true);
    setStep("find");
  }

  function chooseAgain() {
    restoreSearchFocus.current = true;
    setSelectedSlug(null);
    setListOpen(false);
    setStep("find");
  }

  async function saveSelected() {
    if (!selected || saveState === "saving") return;
    setSaveState("saving");
    setSaveError("");
    try {
      const response = await fetch("/api/preferences/default-masjid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: selected.slug }),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResult;
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Your masjid could not be saved.");
      }
      setSaveState("idle");
      setStep("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(
        error instanceof Error && error.message
          ? error.message
          : "Your masjid could not be saved.",
      );
    }
  }

  const masjidCount = `${masjids.length} ${masjids.length === 1 ? "masjid" : "masjids"}`;
  const countLabel = needle
    ? `${matches.length} of ${masjidCount}`
    : masjids.length === 1
      ? "1 masjid"
      : `All ${masjidCount} · A–Z`;
  const coverage = `${masjidCount} so far. More are joining.`;

  const nextTime = selectedNext ? splitTime(selectedNext.jamaat) : null;

  return (
    <div className="landing-grid">
      <div className="landing-copy">
        {step === "find" ? (
          <>
            <h1 className="landing-title">Never miss jamaat at your masjid</h1>
            <p className="landing-lede">
              Choose your masjid once. Every time you open the app after that, its
              next jamaat is the first thing you see.
            </p>

            {masjids.length === 0 ? (
              <div className="chooser-empty" role="status">
                <h2>No masjids are available yet</h2>
                <p>Please try again later or ask a masjid administrator for its direct link.</p>
              </div>
            ) : (
              <div className="finder" ref={finderRef} onKeyDown={onSearchKeyDown}>
                <label className="finder-label" htmlFor={inputId}>
                  Find your masjid
                </label>
                <div className="finder-field">
                  <Search className="finder-icon" size={22} aria-hidden="true" />
                  <input
                    ref={inputRef}
                    id={inputId}
                    className="finder-input"
                    type="search"
                    value={query}
                    placeholder="Tap to see all, or type a name"
                    autoComplete="off"
                    spellCheck={false}
                    aria-controls={listId}
                    aria-describedby={coverageId}
                    onFocus={openList}
                    onClick={openList}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setListOpen(true);
                    }}
                  />
                </div>
                <p id={coverageId} className="finder-coverage">
                  {coverage}
                </p>

                {listOpen ? (
                  <div className="finder-panel" id={listId}>
                    <div className="finder-panel-head">
                      <p className="finder-count" role="status" aria-live="polite">
                        {countLabel}
                      </p>
                      <button
                        type="button"
                        className="finder-close"
                        onClick={closeList}
                        aria-label="Close list"
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                    </div>

                    {matches.length > 0 ? (
                      <ul className="finder-list" aria-label="Masjids">
                        {matches.map((masjid) => {
                          const meta = nextLabel(masjid);
                          return (
                            <li key={masjid.slug}>
                              <button
                                type="button"
                                className="finder-option"
                                onClick={() => pick(masjid.slug)}
                              >
                                <RowArch />
                                <span className="finder-option-text">
                                  <span className="finder-option-name">{masjid.name}</span>
                                  <span className="finder-option-area">{masjid.location}</span>
                                </span>
                                {meta ? <span className="finder-option-meta">{meta}</span> : null}
                                <ChevronRight
                                  className="finder-option-chevron"
                                  size={18}
                                  aria-hidden="true"
                                />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="finder-empty">
                        <p className="finder-empty-title">No masjid matches “{query.trim()}”</p>
                        <p>It may not have joined yet. Try another spelling or the area name.</p>
                      </div>
                    )}

                    <p className="finder-foot">
                      Can&apos;t find your masjid? It may not have joined yet. Ask its
                      committee about adding its timetable.
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            <ul className="landing-benefits">
              <li>
                <Clock size={18} aria-hidden="true" />
                Next jamaat first
              </li>
              <li>
                <Bell size={18} aria-hidden="true" />
                Alerts when jamaat changes
              </li>
              <li>
                <LockKeyhole size={18} aria-hidden="true" />
                No account needed
              </li>
            </ul>
          </>
        ) : null}

        {step === "preview" && selected ? (
          <>
            <button type="button" className="landing-back" onClick={backToList}>
              <ArrowLeft size={18} aria-hidden="true" />
              Back to the list
            </button>
            <h1 ref={headingRef} tabIndex={-1} className="landing-title is-compact">
              {selected.name}
            </h1>
            <p className="landing-location">{selected.location}</p>

            <section className="schedule-panel landing-today" aria-labelledby={todayHeadingId}>
              <div className="section-heading">
                <h2 id={todayHeadingId}>Today&apos;s jamaat times</h2>
              </div>
              {selected.published ? (
                <ol className="schedule-list">
                  {selected.times.map((item) => (
                    <li
                      key={item.prayer}
                      className={selectedNext?.prayer === item.prayer ? "is-next" : undefined}
                    >
                      <span className="prayer-name">
                        <RowArch />
                        <span>{item.prayer}</span>
                        <span className="urdu" lang="ur" dir="rtl">
                          {PRAYER_URDU[item.prayer]}
                        </span>
                      </span>
                      <time dateTime={item.jamaat}>{displayTime(item.jamaat)}</time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="landing-unposted">
                  Today&apos;s jamaat times have not been posted yet. No times are
                  shown until they are posted.
                </p>
              )}
            </section>

            {saveState === "error" ? (
              <p className="form-message error" role="alert">
                {saveError}
              </p>
            ) : null}

            <div className="landing-actions">
              <button
                type="button"
                className="primary-button"
                onClick={saveSelected}
                disabled={saveState === "saving"}
              >
                <Check size={18} aria-hidden="true" />
                {saveState === "saving" ? "Saving…" : "Make this my masjid"}
              </button>
              <Link className="landing-outline-button" href={mosquePublicPath(selected.slug)}>
                Just view the timetable
              </Link>
            </div>
            <p className="landing-note">Saved only in this browser. You can change it any time.</p>
          </>
        ) : null}

        {step === "saved" && selected ? (
          <>
            <p className="landing-saved-badge" role="status">
              <span aria-hidden="true">
                <Check size={14} strokeWidth={3} />
              </span>
              Saved in this browser
            </p>
            <h1 ref={headingRef} tabIndex={-1} className="landing-title is-compact">
              {selected.name} is your masjid
            </h1>
            <p className="landing-lede">
              Next time you open Masjid Prayer Times, you&apos;ll go straight to its
              timetable.
            </p>
            <p className="landing-alert-tip">
              <Bell size={18} aria-hidden="true" />
              To be told when a jamaat time changes, tap the bell on the timetable.
            </p>
            <div className="landing-actions">
              <Link className="primary-button" href={mosquePublicPath(selected.slug)}>
                Open timetable
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <button type="button" className="link-button landing-change" onClick={chooseAgain}>
                Choose a different masjid
              </button>
            </div>
          </>
        ) : null}
      </div>

      <aside
        className="landing-musalla"
        aria-label={selected ? `Next jamaat at ${selected.name}` : "Next jamaat"}
      >
        <div className="next-prayer-wrap">
          <section className="next-prayer-panel is-tall" aria-live="polite">
            <div className="mihrab-arc" aria-hidden="true" />
            <div className="mihrab-arc mihrab-arc-inner" aria-hidden="true" />
            <div className="next-prayer-copy">
              <svg
                className="minaret"
                width="22"
                height="34"
                viewBox="0 0 22 34"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 0v6" />
                <path d="M6 10h10l-1-4H7z" />
                <path d="M5 10c0 8 2 14 6 16 4-2 6-8 6-16" />
                <path d="M11 26v4" />
                <circle cx="11" cy="17" r="2" />
              </svg>
              <p className="next-kicker">
                <span>Next jamaat</span>
              </p>

              {selected && selectedNext && nextTime ? (
                <>
                  <p className="next-name">
                    <span>{selectedNext.prayer}</span>
                    <span className="name-diamond" aria-hidden="true" />
                    <span className="name-urdu" lang="ur" dir="rtl">
                      {PRAYER_URDU[selectedNext.prayer]}
                    </span>
                  </p>
                  <time className="next-time" dateTime={selectedNext.jamaat}>
                    {nextTime.value}
                    {nextTime.suffix ? <span className="next-suffix">{nextTime.suffix}</span> : null}
                  </time>
                  <p className="countdown">
                    <Clock size={16} aria-hidden="true" />
                    <span>
                      {
                        remainingCopy(
                          Math.floor(selectedNext.remainingMinutes / 60),
                          selectedNext.remainingMinutes % 60,
                          selectedNext.isTomorrow,
                        ).en
                      }
                    </span>
                  </p>
                </>
              ) : selected && !selected.published ? (
                <>
                  <p className="awaiting-title">Times not posted yet</p>
                  <p className="awaiting-detail">
                    <span>Today&apos;s jamaat times have not been posted yet.</span>
                  </p>
                </>
              ) : selected ? (
                <p className="awaiting-detail">
                  <span>Calculating…</span>
                </p>
              ) : (
                <>
                  <p className="awaiting-title">Your masjid, at a glance</p>
                  <p className="awaiting-detail">
                    <span>Choose your masjid and its next jamaat appears here.</span>
                  </p>
                </>
              )}

              <div className="diamond-row" aria-hidden="true">
                {DIAMONDS.map((_, index) => (
                  <span key={index} />
                ))}
              </div>
            </div>
          </section>
          <div className="mihrab-tassels" aria-hidden="true">
            {TASSELS.map((_, index) => (
              <span key={index} />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
