import type { PrayerName } from "@/lib/prayers";
import { PRAYER_URDU } from "@/lib/ui-copy";

export type PrayerChange = {
  prayer: PrayerName;
  oldJamaat: string;
  newJamaat: string;
};

export type AlertLocale = "en" | "ur";

export type PrayerChangeNotification = {
  title: string;
  body: string;
};

function displayTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}

function scheduleDate(value: string, locale: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function displayScheduleDate(value: string) {
  return scheduleDate(value, "en-GB");
}

export function buildPrayerChangeNotificationBody(date: string, changes: PrayerChange[]) {
  return buildPrayerChangeNotification("en", date, changes).body;
}

export function buildPrayerChangeNotification(
  locale: AlertLocale,
  date: string,
  changes: PrayerChange[],
): PrayerChangeNotification {
  if (locale === "ur") return urduNotification(date, changes);
  return englishNotification(date, changes);
}

export function buildCompactBilingualNotification(
  date: string,
  changes: PrayerChange[],
): PrayerChangeNotification {
  const english = englishNotification(date, changes);
  const urdu = urduNotification(date, changes);
  if (changes.length === 1) {
    const change = changes[0];
    return {
      title: `${english.title} · ${urdu.title}`,
      body: `${change.prayer} ${displayTime(change.oldJamaat)} → ${displayTime(change.newJamaat)} · ${PRAYER_URDU[change.prayer]} ${displayTime(change.oldJamaat)} → ${displayTime(change.newJamaat)}`,
    };
  }

  return {
    title: `${english.title} · ${urdu.title}`,
    body: `${changes.length} jamaat times updated · ${changes.length} جماعت کے اوقات تبدیل`,
  };
}

export function notificationForLocale(
  locale: string | null | undefined,
  date: string,
  changes: PrayerChange[],
) {
  if (locale === "en" || locale === "ur") {
    return buildPrayerChangeNotification(locale, date, changes);
  }
  return buildCompactBilingualNotification(date, changes);
}

function englishNotification(date: string, changes: PrayerChange[]): PrayerChangeNotification {
  const effectiveDate = displayScheduleDate(date);
  if (changes.length === 1) {
    const change = changes[0];
    return {
      title: "Jamaat time changed",
      body: `${change.prayer} jamaat: ${displayTime(change.oldJamaat)} → ${displayTime(change.newJamaat)}, effective ${effectiveDate}.`,
    };
  }

  return {
    title: "Jamaat time changed",
    body: `${changes.length} jamaat times were updated, effective ${effectiveDate}.`,
  };
}

function urduNotification(date: string, changes: PrayerChange[]): PrayerChangeNotification {
  const effectiveDate = scheduleDate(date, "ur-PK");
  if (changes.length === 1) {
    const change = changes[0];
    return {
      title: "جماعت کا وقت تبدیل",
      body: `${PRAYER_URDU[change.prayer]} جماعت: ${displayTime(change.oldJamaat)} → ${displayTime(change.newJamaat)}، ${effectiveDate} سے۔`,
    };
  }

  return {
    title: "جماعت کا وقت تبدیل",
    body: `${changes.length} جماعت کے اوقات تبدیل ہوئے، ${effectiveDate} سے۔`,
  };
}
