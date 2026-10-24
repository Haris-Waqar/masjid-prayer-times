import { dateInTimezone } from "@/lib/prayers";
import { getPrayerTimes, getSettings } from "@/lib/schedule";
import { PrayerDashboard } from "@/app/prayer-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const settings = await getSettings();
  const date = dateInTimezone(settings.timezone);
  const times = await getPrayerTimes(date);
  return (
    <PrayerDashboard
      settings={settings}
      date={date}
      times={times}
      isAdmin={false}
      adminHref="/admin"
    />
  );
}
