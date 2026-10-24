export const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

export type PrayerName = (typeof PRAYERS)[number];

export type PrayerTime = {
  prayer: PrayerName;
  prayerStart: string;
  jamaat: string;
};

export type MosqueSettings = {
  name: string;
  location: string;
  timezone: string;
  updatedAt: string;
};

export const DEFAULT_SETTINGS: MosqueSettings = {
  name: "Jamia Masjid Fazaia Town",
  location: "Block H, Fazaia Housing Society, Lahore",
  timezone: "Asia/Karachi",
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_PRAYER_TIMES: PrayerTime[] = [
  { prayer: "Fajr", prayerStart: "05:20", jamaat: "05:45" },
  { prayer: "Dhuhr", prayerStart: "12:30", jamaat: "13:15" },
  { prayer: "Asr", prayerStart: "15:45", jamaat: "16:00" },
  { prayer: "Maghrib", prayerStart: "17:35", jamaat: "17:40" },
  { prayer: "Isha", prayerStart: "19:00", jamaat: "19:30" },
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

export function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
