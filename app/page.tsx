import { dateInTimezone } from "@/lib/prayers";
import { getAdminSession } from "@/lib/admin";
import { canEditSchedule } from "@/lib/admin-policy";
import { getPrayerSchedule, getSettings } from "@/lib/schedule";
import { PrayerDashboard } from "@/app/prayer-dashboard";

export default async function Home() {
  const settings = await getSettings();
  const date = dateInTimezone(settings.timezone);
  const [schedule, { access }] = await Promise.all([
    getPrayerSchedule(date),
    getAdminSession(),
  ]);
  return (
    <PrayerDashboard
      settings={settings}
      date={date}
      times={schedule.times}
      schedulePublished={schedule.isPublished}
      canUpdateTimes={canEditSchedule(access)}
    />
  );
}
