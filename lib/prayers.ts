export const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
export const JUMUAH_PRAYER = "Jumu'ah" as const;

/** All timetable rows: daily five, then Jumu'ah. */
export const SCHEDULE_PRAYERS = [...PRAYERS, JUMUAH_PRAYER] as const;

export type DailyPrayerName = (typeof PRAYERS)[number];
export type PrayerName = DailyPrayerName | typeof JUMUAH_PRAYER;

export type PrayerTime = {
  prayer: PrayerName;
  jamaat: string;
};

export type MosqueSettings = {
  name: string;
  location: string;
  timezone: string;
  updatedAt: string;
};

export const DEFAULT_SETTINGS: MosqueSettings = {
  name: "Jamia Masjid Fazaia Housing",
  location: "Block H, Fazaia Housing Society, Lahore",
  timezone: "Asia/Karachi",
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_PRAYER_TIMES: PrayerTime[] = [
  { prayer: "Fajr", jamaat: "05:30" },
  { prayer: "Dhuhr", jamaat: "13:45" },
  { prayer: "Asr", jamaat: "16:00" },
  { prayer: "Maghrib", jamaat: "17:25" },
  { prayer: "Isha", jamaat: "19:30" },
];

export const DEFAULT_JUMUAH_TIME: PrayerTime = {
  prayer: JUMUAH_PRAYER,
  jamaat: "13:45",
};

export function isJumuahPrayer(prayer: PrayerName): boolean {
  return prayer === JUMUAH_PRAYER;
}

/** Stable DOM id fragment (apostrophe-safe). */
export function prayerFieldId(prayer: PrayerName): string {
  return prayer === JUMUAH_PRAYER ? "Jumuah" : prayer;
}

export function dateInTimezone(timezone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isPrayerName(value: string): value is PrayerName {
  return (
    PRAYERS.includes(value as DailyPrayerName) || value === JUMUAH_PRAYER
  );
}

export function normalizeTime(value: string): string | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d{1,6})?)?$/.exec(value);
  return match ? `${match[1]}:${match[2]}` : null;
}

export function isTime(value: string): boolean {
  return normalizeTime(value) !== null;
}

export function isScheduleDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function havePrayerTimesChanged(
  current: PrayerTime[],
  baseline: PrayerTime[],
): boolean {
  if (current.length !== baseline.length) return true;
  return current.some(
    (item, index) =>
      item.prayer !== baseline[index]?.prayer ||
      item.jamaat !== baseline[index]?.jamaat,
  );
}
