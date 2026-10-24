import {
  DEFAULT_PRAYER_TIMES,
  PRAYERS,
  normalizeTime,
  type PrayerName,
  type PrayerTime,
} from "@/lib/prayers";

export type PrayerScheduleRow = {
  date: string;
  prayer: string;
  jamaat: string;
};

export function resolvePrayerSchedule(
  rows: PrayerScheduleRow[],
  date: string,
): { times: PrayerTime[]; isPublished: boolean } {
  const applicableRows = rows
    .filter((row) => row.date <= date)
    .sort((left, right) => right.date.localeCompare(left.date));
  const byPrayer = new Map<PrayerName, PrayerScheduleRow>();

  for (const row of applicableRows) {
    if (
      PRAYERS.includes(row.prayer as PrayerName) &&
      !byPrayer.has(row.prayer as PrayerName)
    ) {
      byPrayer.set(row.prayer as PrayerName, row);
    }
  }

  const times = PRAYERS.map((prayer) => {
    const saved = byPrayer.get(prayer);
    const fallback = DEFAULT_PRAYER_TIMES.find((item) => item.prayer === prayer)!;
    const jamaat = saved ? normalizeTime(saved.jamaat) : null;
    return jamaat ? { prayer, jamaat } : fallback;
  });

  return { times, isPublished: PRAYERS.every((prayer) => byPrayer.has(prayer)) };
}
