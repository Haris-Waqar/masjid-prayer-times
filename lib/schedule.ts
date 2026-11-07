import "server-only";
import { unstable_cache } from "next/cache";
import {
  MOSQUE_DIRECTORY_CACHE_TAG,
  prayerScheduleCacheTag,
} from "@/lib/cache-tags";
import {
  isValidMosqueSlug,
  mapMosqueRow,
  type Mosque,
} from "@/lib/mosques";
import { createPublicClient } from "@/lib/supabase/public";
import {
  DEFAULT_SETTINGS,
  type MosqueSettings,
  type PrayerTime,
} from "@/lib/prayers";
import { resolvePrayerSchedule, type PrayerScheduleRow } from "@/lib/schedule-data";

const FALLBACK_FAZAIA_ID = "00000000-0000-4000-8000-000000000001";
const FALLBACK_FAZAIA_SLUG = "fazaia-town";

export const FALLBACK_FAZAIA_MOSQUE: Mosque = {
  id: FALLBACK_FAZAIA_ID,
  slug: FALLBACK_FAZAIA_SLUG,
  name: DEFAULT_SETTINGS.name,
  location: DEFAULT_SETTINGS.location,
  timezone: DEFAULT_SETTINGS.timezone,
  active: true,
  createdAt: DEFAULT_SETTINGS.updatedAt,
  updatedAt: DEFAULT_SETTINGS.updatedAt,
};

type MosqueRow = {
  id: string;
  slug: string;
  name: string;
  location: string;
  timezone: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

async function loadActiveMosques(): Promise<Mosque[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("mosques")
      .select("id, slug, name, location, timezone, active, created_at, updated_at")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) return [FALLBACK_FAZAIA_MOSQUE];
    return ((data ?? []) as MosqueRow[])
      .map(mapMosqueRow)
      .filter((mosque): mosque is Mosque => mosque !== null && mosque.active);
  } catch {
    return [FALLBACK_FAZAIA_MOSQUE];
  }
}

export const getActiveMosques = unstable_cache(
  loadActiveMosques,
  ["active-mosques"],
  { tags: [MOSQUE_DIRECTORY_CACHE_TAG], revalidate: 3600 },
);

async function loadActiveMosqueBySlug(slug: string): Promise<Mosque | null> {
  if (!isValidMosqueSlug(slug)) return null;

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("mosques")
      .select("id, slug, name, location, timezone, active, created_at, updated_at")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();

    if (error) {
      return slug === FALLBACK_FAZAIA_SLUG ? FALLBACK_FAZAIA_MOSQUE : null;
    }

    const mosque = mapMosqueRow(data);
    return mosque?.active ? mosque : null;
  } catch {
    return slug === FALLBACK_FAZAIA_SLUG ? FALLBACK_FAZAIA_MOSQUE : null;
  }
}

export async function getActiveMosqueBySlug(slug: string) {
  if (!isValidMosqueSlug(slug)) return null;
  return unstable_cache(
    () => loadActiveMosqueBySlug(slug),
    ["active-mosque", slug],
    { tags: [MOSQUE_DIRECTORY_CACHE_TAG], revalidate: 3600 },
  )();
}

/** Temporary compatibility for administrator code while it adopts mosque IDs. */
export async function getSettings(): Promise<MosqueSettings> {
  const mosque = await getActiveMosqueBySlug(FALLBACK_FAZAIA_SLUG);
  if (!mosque) return DEFAULT_SETTINGS;
  return {
    name: mosque.name,
    location: mosque.location,
    timezone: mosque.timezone,
    updatedAt: mosque.updatedAt,
  };
}

export async function getPrayerTimes(
  mosqueId: string,
  date: string,
): Promise<PrayerTime[]> {
  const schedule = await getPrayerSchedule(mosqueId, date);
  return schedule.times;
}

async function loadPrayerSchedule(
  mosqueId: string,
  date: string,
): Promise<{ times: PrayerTime[]; isPublished: boolean }> {
  try {
    const supabase = createPublicClient();
    const { data: rows, error } = await supabase
      .from("prayer_times")
      .select("date, prayer, jamaat")
      .eq("mosque_id", mosqueId)
      .lte("date", date)
      .order("date", { ascending: false });

    if (error) return resolvePrayerSchedule([], date);
    return resolvePrayerSchedule((rows ?? []) as PrayerScheduleRow[], date);
  } catch {
    return resolvePrayerSchedule([], date);
  }
}

export function getPrayerSchedule(
  mosqueId: string,
  date: string,
): Promise<{ times: PrayerTime[]; isPublished: boolean }>;
/** Temporary compatibility for administrator code while it adopts mosque IDs. */
export function getPrayerSchedule(
  date: string,
): Promise<{ times: PrayerTime[]; isPublished: boolean }>;
export async function getPrayerSchedule(
  mosqueIdOrDate: string,
  requestedDate?: string,
): Promise<{ times: PrayerTime[]; isPublished: boolean }> {
  let mosqueId = mosqueIdOrDate;
  let date = requestedDate;

  if (!date) {
    const mosque = await getActiveMosqueBySlug(FALLBACK_FAZAIA_SLUG);
    mosqueId = mosque?.id ?? FALLBACK_FAZAIA_ID;
    date = mosqueIdOrDate;
  }

  return unstable_cache(
    () => loadPrayerSchedule(mosqueId, date),
    ["prayer-schedule", mosqueId, date],
    { tags: [prayerScheduleCacheTag(mosqueId)], revalidate: 300 },
  )();
}
