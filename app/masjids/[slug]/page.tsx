import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PrayerDashboard } from "@/app/prayer-dashboard";
import { getAdminSession } from "@/lib/admin";
import { canEditMosque } from "@/lib/admin-policy";
import {
  DEFAULT_MOSQUE_COOKIE,
  parseDefaultMosqueSlug,
} from "@/lib/default-mosque";
import { isValidMosqueSlug, mosquePublicPath } from "@/lib/mosques";
import { dateInTimezone } from "@/lib/prayers";
import {
  getActiveMosqueBySlug,
  getActiveMosques,
  getPrayerSchedule,
} from "@/lib/schedule";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidMosqueSlug(slug)) return { title: "Masjid unavailable" };

  const mosque = await getActiveMosqueBySlug(slug);
  if (!mosque) return { title: "Masjid unavailable" };

  return {
    title: `${mosque.name} · Jamaat Times`,
    description: `Current jamaat times for ${mosque.name}, ${mosque.location}.`,
    alternates: { canonical: mosquePublicPath(mosque.slug) },
  };
}

export default async function MosqueTimetablePage({ params }: Props) {
  const { slug } = await params;
  if (!isValidMosqueSlug(slug)) notFound();

  const mosque = await getActiveMosqueBySlug(slug);
  if (!mosque) notFound();

  const date = dateInTimezone(mosque.timezone);
  const [schedule, activeMosques, { access }, cookieStore] = await Promise.all([
    getPrayerSchedule(mosque.id, date),
    getActiveMosques(),
    getAdminSession(),
    cookies(),
  ]);
  const availableMosques = activeMosques.some((item) => item.id === mosque.id)
    ? activeMosques
    : [mosque, ...activeMosques];
  const savedSlug = parseDefaultMosqueSlug(
    cookieStore.get(DEFAULT_MOSQUE_COOKIE)?.value,
  );

  return (
    <PrayerDashboard
      mosque={mosque}
      availableMosques={availableMosques}
      isDefaultMosque={savedSlug === mosque.slug}
      date={date}
      times={schedule.times}
      schedulePublished={schedule.isPublished}
      canUpdateTimes={canEditMosque(access, mosque.id)}
    />
  );
}
