import { describe, expect, it } from "vitest";
import { PRAYERS } from "@/lib/prayers";
import { resolvePrayerSchedule, type PrayerScheduleRow } from "@/lib/schedule-data";

function rows(date: string, fajr: string): PrayerScheduleRow[] {
  const times = [fajr, "13:45", "16:00", "17:25", "19:30"];
  return PRAYERS.map((prayer, index) => ({ date, prayer, jamaat: times[index] }));
}

describe("resolvePrayerSchedule", () => {
  const current = rows("2026-10-25", "05:30");
  const future = rows("2026-11-01", "05:15");
  const later = rows("2026-12-01", "05:00");

  it("keeps a future schedule invisible before its effective date", () => {
    const schedule = resolvePrayerSchedule([...current, ...future], "2026-10-31");

    expect(schedule.isPublished).toBe(true);
    expect(schedule.times[0]).toEqual({ prayer: "Fajr", jamaat: "05:30" });
  });

  it("activates a schedule on its effective date", () => {
    const schedule = resolvePrayerSchedule([...current, ...future], "2026-11-01");

    expect(schedule.times[0]).toEqual({ prayer: "Fajr", jamaat: "05:15" });
  });

  it("uses the latest applicable schedule", () => {
    const schedule = resolvePrayerSchedule(
      [...later, ...current, ...future],
      "2026-12-15",
    );

    expect(schedule.times[0]).toEqual({ prayer: "Fajr", jamaat: "05:00" });
  });

  it("normalizes database time values for the editor", () => {
    const schedule = resolvePrayerSchedule(
      rows("2026-11-01", "05:15:00"),
      "2026-11-01",
    );

    expect(schedule.times[0]).toEqual({ prayer: "Fajr", jamaat: "05:15" });
  });
});
