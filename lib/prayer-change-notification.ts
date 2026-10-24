import type { PrayerName } from "@/lib/prayers";

export type PrayerChange = {
  prayer: PrayerName;
  oldJamaat: string;
  newJamaat: string;
};

function displayTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}

export function displayScheduleDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function buildPrayerChangeNotificationBody(
  date: string,
  changes: PrayerChange[],
) {
  const effectiveDate = displayScheduleDate(date);
  if (changes.length === 1) {
    const change = changes[0];
    return `${change.prayer} jamaat: ${displayTime(change.oldJamaat)} → ${displayTime(change.newJamaat)}, effective ${effectiveDate}.`;
  }

  return `${changes.length} jamaat times were updated, effective ${effectiveDate}.`;
}
