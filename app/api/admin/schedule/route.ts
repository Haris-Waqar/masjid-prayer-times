import { getAuthorizedAdmin } from "@/lib/admin";
import {
  PRAYERS,
  isPrayerName,
  isTime,
  type PrayerTime,
} from "@/lib/prayers";
import { notifyPrayerChanges } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

type ScheduleInput = {
  date?: string;
  times?: Array<{ prayer?: string; prayerStart?: string; jamaat?: string }>;
};

export async function POST(request: Request) {
  const user = await getAuthorizedAdmin();
  if (!user?.email) {
    return Response.json({ error: "Authorized editor access is required." }, { status: 403 });
  }

  const input = (await request.json()) as ScheduleInput;
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return Response.json({ error: "Choose a valid effective date." }, { status: 400 });
  }
  if (!Array.isArray(input.times) || input.times.length !== PRAYERS.length) {
    return Response.json({ error: "All five prayer times are required." }, { status: 400 });
  }

  const normalized: PrayerTime[] = [];
  for (const item of input.times) {
    if (
      !item.prayer ||
      !isPrayerName(item.prayer) ||
      !item.prayerStart ||
      !isTime(item.prayerStart) ||
      !item.jamaat ||
      !isTime(item.jamaat)
    ) {
      return Response.json({ error: "One or more prayer times are invalid." }, { status: 400 });
    }
    normalized.push({
      prayer: item.prayer,
      prayerStart: item.prayerStart,
      jamaat: item.jamaat,
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
      prayer_start: item.prayerStart,
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
  return Response.json({ ok: true, changed: changes.length, notified });
}
