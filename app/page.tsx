import { dateInTimezone } from "@/lib/prayers";
import { getPrayerSchedule, getSettings } from "@/lib/schedule";
import { PrayerDashboard } from "@/app/prayer-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const settings = await getSettings();
  const date = dateInTimezone(settings.timezone);
  const schedule = await getPrayerSchedule(date);
  return (
    <PrayerDashboard
      settings={settings}
      date={date}
      times={schedule.times}
      schedulePublished={schedule.isPublished}
      isAdmin={false}
      adminHref="/admin/login"
    />
  );
}
