import { isJumuahPrayer, type PrayerTime } from "@/lib/prayers";

const MINUTES_PER_DAY = 24 * 60;

/** Minutes after midnight for a mosque-local "HH:MM" string. */
export function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Formats a mosque-local "HH:MM" string as "5:12 PM". The wall-clock value is
 * pinned to UTC so the viewer's or server's timezone cannot shift it.
 */
export function displayTime(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2020, 0, 1, hours, minutes)));
}

export function splitTime(value: string): { value: string; suffix: string } {
  const formatted = displayTime(value);
  const match = formatted.match(/^(.*?)\s*(AM|PM)$/i);
  return match
    ? { value: match[1], suffix: match[2].toUpperCase() }
    : { value: formatted, suffix: "" };
}

/** Minutes after midnight in the given IANA timezone at `now`. */
export function minutesInTimezone(timezone: string, now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minutes = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return (hours % 24) * 60 + minutes;
}

export type NextJamaat = {
  prayer: PrayerTime["prayer"];
  jamaat: string;
  isTomorrow: boolean;
  remainingMinutes: number;
};

/**
 * The next daily jamaat after `currentMinutes`. Jumu'ah is ignored; once Isha
 * has passed, the first daily jamaat is returned as tomorrow's.
 */
export function findNextJamaat(
  times: PrayerTime[],
  currentMinutes: number,
): NextJamaat | null {
  const daily = times.filter((item) => !isJumuahPrayer(item.prayer));
  if (daily.length === 0) return null;

  const upcoming = daily.find((item) => toMinutes(item.jamaat) > currentMinutes);
  const next = upcoming ?? daily[0];
  const isTomorrow = !upcoming;
  const remainingMinutes = Math.max(
    0,
    toMinutes(next.jamaat) + (isTomorrow ? MINUTES_PER_DAY : 0) - currentMinutes,
  );
  return { prayer: next.prayer, jamaat: next.jamaat, isTomorrow, remainingMinutes };
}
