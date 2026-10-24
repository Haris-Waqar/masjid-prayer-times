import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PRAYER_TIMES,
  DEFAULT_SETTINGS,
  PRAYERS,
  normalizeTime,
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
      .select("date, prayer, jamaat")
      .lte("date", date)
      .order("date", { ascending: false });

    const byPrayer = new Map<string, { prayer: string; jamaat: string }>();
    for (const row of rows ?? []) {
      if (!byPrayer.has(row.prayer)) byPrayer.set(row.prayer, row);
    }
    const times = PRAYERS.map((prayer) => {
      const saved = byPrayer.get(prayer);
      const fallback = DEFAULT_PRAYER_TIMES.find((item) => item.prayer === prayer)!;
      const jamaat = saved ? normalizeTime(saved.jamaat) : null;
      return jamaat ? { prayer, jamaat } : fallback;
    });
    return { times, isPublished: PRAYERS.every((prayer) => byPrayer.has(prayer)) };
  } catch {
    return { times: DEFAULT_PRAYER_TIMES, isPublished: false };
  }
}
