import { revalidatePath, revalidateTag } from "next/cache";
import { getAuthorizedAdmin } from "@/lib/admin";
import { PRAYER_SCHEDULE_CACHE_TAG } from "@/lib/cache-tags";
import {
  PRAYERS,
  isPrayerName,
  isTime,
  normalizeTime,
  type PrayerTime,
} from "@/lib/prayers";
import { notifyPrayerChanges } from "@/lib/push";
import {
  createAdminClient,
  SupabaseAdminConfigurationError,
} from "@/lib/supabase/admin";

type ScheduleInput = {
  date?: string;
  times?: Array<{ prayer?: string; jamaat?: string }>;
};

async function publishSchedule(request: Request) {
  const user = await getAuthorizedAdmin();
  if (!user?.email) {
    return Response.json({ error: "Authorized editor access is required." }, { status: 403 });
  }

  const input = (await request.json()) as ScheduleInput;
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return Response.json({ error: "Choose a valid effective date." }, { status: 400 });
  }
  if (!Array.isArray(input.times) || input.times.length !== PRAYERS.length) {
    return Response.json({ error: "All five jamaat times are required." }, { status: 400 });
  }

  const normalized: PrayerTime[] = [];
  for (const item of input.times) {
    const jamaat = item.jamaat ? normalizeTime(item.jamaat) : null;
    if (
      !item.prayer ||
      !isPrayerName(item.prayer) ||
      !jamaat
    ) {
      return Response.json({ error: "One or more jamaat times are invalid." }, { status: 400 });
    }
    normalized.push({
      prayer: item.prayer,
      jamaat,
    });
  }
  if (new Set(normalized.map((item) => item.prayer)).size !== PRAYERS.length) {
    return Response.json({ error: "Each prayer must appear exactly once." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("publish_prayer_schedule", {
    p_date: input.date,
    p_times: normalized.map((item) => ({
      prayer: item.prayer,
      jamaat: item.jamaat,
    })),
    p_changed_by: user.email,
  });
  if (error || !Array.isArray(data)) {
    return Response.json({ error: "Could not publish the timetable." }, { status: 500 });
  }

  const changes = data.filter(
    (item): item is { prayer: PrayerTime["prayer"]; oldJamaat: string; newJamaat: string } =>
      typeof item === "object" &&
      item !== null &&
      isPrayerName(item.prayer) &&
      isTime(item.oldJamaat) &&
      isTime(item.newJamaat),
  );

  const notified = await notifyPrayerChanges(input.date, changes);
  revalidateTag(PRAYER_SCHEDULE_CACHE_TAG, { expire: 0 });
  revalidatePath("/", "page");
  return Response.json({ ok: true, changed: changes.length, notified });
}

export async function POST(request: Request) {
  try {
    return await publishSchedule(request);
  } catch (error) {
    if (error instanceof SupabaseAdminConfigurationError) {
      return Response.json(
        { error: "Server setup is incomplete. Add the Supabase secret key and restart the app." },
        { status: 503 },
      );
    }

    console.error("Failed to publish prayer schedule", error);
    return Response.json(
      { error: "The timetable could not be published. Please try again." },
      { status: 500 },
    );
  }
}
