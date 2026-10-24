export const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

export type PrayerName = (typeof PRAYERS)[number];

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

export function dateInTimezone(timezone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isPrayerName(value: string): value is PrayerName {
  return PRAYERS.includes(value as PrayerName);
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
  return current.some(
    (item, index) => item.jamaat !== baseline[index]?.jamaat,
  );
}
