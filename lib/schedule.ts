import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PRAYER_TIMES,
  DEFAULT_SETTINGS,
  PRAYERS,
  type MosqueSettings,
  type PrayerTime,
} from "@/lib/prayers";

export async function getSettings(): Promise<MosqueSettings> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("mosque_settings")
      .select("name, location, timezone, updated_at")
      .eq("id", 1)
      .maybeSingle();

    if (!data) return DEFAULT_SETTINGS;
    return {
      name: data.name,
      location: data.location,
      timezone: data.timezone,
      updatedAt: data.updated_at,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function getPrayerTimes(date: string): Promise<PrayerTime[]> {
  const schedule = await getPrayerSchedule(date);
  return schedule.times;
}

export async function getPrayerSchedule(
  date: string,
): Promise<{ times: PrayerTime[]; isPublished: boolean }> {
  try {
    const supabase = await createClient();
    const { data: rows } = await supabase
      .from("prayer_times")
      .select("prayer, prayer_start, jamaat")
      .eq("date", date);

    const byPrayer = new Map((rows ?? []).map((row) => [row.prayer, row]));
    const times = PRAYERS.map((prayer) => {
      const saved = byPrayer.get(prayer);
      const fallback = DEFAULT_PRAYER_TIMES.find((item) => item.prayer === prayer)!;
      return saved
        ? { prayer, prayerStart: saved.prayer_start, jamaat: saved.jamaat }
        : fallback;
    });
    return { times, isPublished: PRAYERS.every((prayer) => byPrayer.has(prayer)) };
  } catch {
    return { times: DEFAULT_PRAYER_TIMES, isPublished: false };
  }
}
