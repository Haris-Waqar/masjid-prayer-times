import { revalidatePath, revalidateTag } from "next/cache";
import { getAdminSession } from "@/lib/admin";
import { canEditSchedule } from "@/lib/admin-policy";
import { PRAYER_SCHEDULE_CACHE_TAG } from "@/lib/cache-tags";
import {
  SCHEDULE_PRAYERS,
  dateInTimezone,
  isPrayerName,
  isScheduleDate,
  isTime,
  normalizeTime,
  type PrayerTime,
} from "@/lib/prayers";
import { notifyPrayerChanges } from "@/lib/push";
import { getPrayerSchedule, getSettings } from "@/lib/schedule";
import {
  createAdminClient,
  SupabaseAdminConfigurationError,
} from "@/lib/supabase/admin";

type ScheduleInput = {
  date?: string;
  times?: Array<{ prayer?: string; jamaat?: string }>;
};

async function validateEffectiveDate(date: string | undefined) {
  if (!date || !isScheduleDate(date)) {
    return "Choose a valid effective date.";
  }

  const settings = await getSettings();
  const today = dateInTimezone(settings.timezone);
  return date < today ? "Choose today or a future effective date." : null;
}

async function loadSchedule(request: Request) {
  const { access, user } = await getAdminSession();
  if (!user)
    return Response.json({ error: "Sign in is required." }, { status: 401 });
  if (!canEditSchedule(access))
    return Response.json(
      { error: "Authorized access is required." },
      { status: 403 },
    );

  // No `date` param means "today" in the masjid timezone, so the editor can
  // bootstrap its initial state with a single client fetch and without having
  // to know the timezone itself.
  let date = new URL(request.url).searchParams.get("date") ?? undefined;
  if (!date) {
    const settings = await getSettings();
    date = dateInTimezone(settings.timezone);
  }
  const dateError = await validateEffectiveDate(date);
  if (dateError) return Response.json({ error: dateError }, { status: 400 });

  const schedule = await getPrayerSchedule(date);
  return Response.json({ date, times: schedule.times });
}

async function publishSchedule(request: Request) {
  const { access, user } = await getAdminSession();
  if (!user)
    return Response.json({ error: "Sign in is required." }, { status: 401 });
  if (!canEditSchedule(access) || !access)
    return Response.json(
      { error: "Authorized access is required." },
      { status: 403 },
    );

  const input = (await request.json()) as ScheduleInput;
  const dateError = await validateEffectiveDate(input.date);
  if (dateError) return Response.json({ error: dateError }, { status: 400 });
  const effectiveDate = input.date!;
  if (
    !Array.isArray(input.times) ||
    input.times.length !== SCHEDULE_PRAYERS.length
  ) {
    return Response.json(
      { error: "All five daily jamaat times and Jumu'ah are required." },
      { status: 400 },
    );
  }

  const normalized: PrayerTime[] = [];
  for (const item of input.times) {
    const jamaat = item.jamaat ? normalizeTime(item.jamaat) : null;
    if (!item.prayer || !isPrayerName(item.prayer) || !jamaat) {
      return Response.json(
        { error: "One or more jamaat times are invalid." },
        { status: 400 },
      );
    }
    normalized.push({
      prayer: item.prayer,
      jamaat,
    });
  }
  const uniquePrayers = new Set(normalized.map((item) => item.prayer));
  if (
    uniquePrayers.size !== SCHEDULE_PRAYERS.length ||
    !SCHEDULE_PRAYERS.every((prayer) => uniquePrayers.has(prayer))
  ) {
    return Response.json(
      { error: "Each prayer must appear exactly once." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("publish_prayer_schedule", {
    p_date: effectiveDate,
    p_times: normalized.map((item) => ({
      prayer: item.prayer,
      jamaat: item.jamaat,
    })),
    p_changed_by: access.email,
  });
  if (error || !Array.isArray(data)) {
    return Response.json(
      { error: "Could not post the jamaat times." },
      { status: 500 },
    );
  }

  const changes = data.filter(
    (
      item,
    ): item is {
      prayer: PrayerTime["prayer"];
      oldJamaat: string;
      newJamaat: string;
    } =>
      typeof item === "object" &&
      item !== null &&
      isPrayerName(item.prayer) &&
      isTime(item.oldJamaat) &&
      isTime(item.newJamaat),
  );

  const notified = await notifyPrayerChanges(effectiveDate, changes);
  revalidateTag(PRAYER_SCHEDULE_CACHE_TAG, { expire: 0 });
  revalidatePath("/", "page");
  return Response.json({ ok: true, changed: changes.length, notified });
}

export async function GET(request: Request) {
  try {
    return await loadSchedule(request);
  } catch (error) {
    console.error("Failed to load prayer schedule", error);
    return Response.json(
      { error: "Jamaat times could not be loaded. Please try again." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    return await publishSchedule(request);
  } catch (error) {
    if (error instanceof SupabaseAdminConfigurationError) {
      return Response.json(
        {
          error:
            "Server setup is incomplete. Add the Supabase secret key and restart the app.",
        },
        { status: 503 },
      );
    }

    console.error("Failed to publish prayer schedule", error);
    return Response.json(
      { error: "Jamaat times could not be posted. Please try again." },
      { status: 500 },
    );
  }
}
