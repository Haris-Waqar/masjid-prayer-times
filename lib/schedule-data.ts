import {
  DEFAULT_JUMUAH_TIME,
  DEFAULT_PRAYER_TIMES,
  JUMUAH_PRAYER,
  PRAYERS,
  SCHEDULE_PRAYERS,
  isPrayerName,
  normalizeTime,
  type PrayerName,
  type PrayerTime,
} from "@/lib/prayers";

export type PrayerScheduleRow = {
  date: string;
  prayer: string;
  jamaat: string;
};

function defaultForPrayer(prayer: PrayerName): PrayerTime {
  if (prayer === JUMUAH_PRAYER) return DEFAULT_JUMUAH_TIME;
  const fallback = DEFAULT_PRAYER_TIMES.find((item) => item.prayer === prayer);
  if (!fallback) {
    throw new Error(`Missing default jamaat time for ${prayer}`);
  }
  return fallback;
}

export function resolvePrayerSchedule(
  rows: PrayerScheduleRow[],
  date: string,
): { times: PrayerTime[]; isPublished: boolean } {
  const applicableRows = rows
    .filter((row) => row.date <= date)
    .sort((left, right) => right.date.localeCompare(left.date));
  const byPrayer = new Map<PrayerName, PrayerScheduleRow>();

  for (const row of applicableRows) {
    if (isPrayerName(row.prayer) && !byPrayer.has(row.prayer)) {
      byPrayer.set(row.prayer, row);
    }
  }

  const times = SCHEDULE_PRAYERS.map((prayer) => {
    const saved = byPrayer.get(prayer);
    const fallback = defaultForPrayer(prayer);
    const jamaat = saved ? normalizeTime(saved.jamaat) : null;
    return jamaat ? { prayer, jamaat } : fallback;
  });

  // Published means the five daily prayers exist; Jumu'ah falls back to default
  // until an editor posts a schedule that includes it.
  return { times, isPublished: PRAYERS.every((prayer) => byPrayer.has(prayer)) };
}
