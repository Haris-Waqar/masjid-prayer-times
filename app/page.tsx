import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { MasjidOption } from "@/app/_components/masjid-finder";
import { MosqueChooser } from "@/app/mosque-chooser";
import {
  DEFAULT_MOSQUE_COOKIE,
  parseDefaultMosqueSlug,
} from "@/lib/default-mosque";
import { mosquePublicPath, type Mosque } from "@/lib/mosques";
import { dateInTimezone, isJumuahPrayer } from "@/lib/prayers";
import {
  getActiveMosqueBySlug,
  getActiveMosques,
  getPrayerSchedule,
} from "@/lib/schedule";

async function toMasjidOption(mosque: Mosque): Promise<MasjidOption> {
  // Each mosque's "today" is its own local date, never the server's.
  const schedule = await getPrayerSchedule(mosque.id, dateInTimezone(mosque.timezone));
  return {
    id: mosque.id,
    slug: mosque.slug,
    name: mosque.name,
    location: mosque.location,
    timezone: mosque.timezone,
    published: schedule.isPublished,
    // Unpublished schedules hold fallback values; never send them as real times.
    times: schedule.isPublished
      ? schedule.times.filter((item) => !isJumuahPrayer(item.prayer))
      : [],
  };
}

export default async function Home() {
  const cookieStore = await cookies();
  const savedCookie = cookieStore.get(DEFAULT_MOSQUE_COOKIE)?.value;
  const savedSlug = parseDefaultMosqueSlug(savedCookie);
  const [mosques, savedMosque] = await Promise.all([
    getActiveMosques(),
    savedSlug ? getActiveMosqueBySlug(savedSlug) : Promise.resolve(null),
  ]);

  if (savedMosque) redirect(mosquePublicPath(savedMosque.slug));

  const masjids = await Promise.all(mosques.map(toMasjidOption));

  return <MosqueChooser masjids={masjids} clearStaleDefault={Boolean(savedCookie)} />;
}
