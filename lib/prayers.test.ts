import { describe, expect, it } from "vitest";
import {
  havePrayerTimesChanged,
  isScheduleDate,
  isTime,
  normalizeTime,
  type PrayerTime,
} from "@/lib/prayers";

describe("isScheduleDate", () => {
  it.each(["2026-10-25", "2028-02-29"])("accepts calendar date %s", (value) => {
    expect(isScheduleDate(value)).toBe(true);
  });

  it.each(["2026-2-01", "2026-02-30", "2025-02-29", "not-a-date"])(
    "rejects invalid calendar date %s",
    (value) => {
      expect(isScheduleDate(value)).toBe(false);
    },
  );
});

describe("normalizeTime", () => {
  it.each([
    ["05:30", "05:30"],
    ["05:30:00", "05:30"],
    ["19:15:42.123456", "19:15"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeTime(input)).toBe(expected);
    expect(isTime(input)).toBe(true);
  });

  it.each(["", "5:30", "24:00", "12:60", "12:30:60", "12:30:00.1234567"])(
    "rejects invalid value %s",
    (input) => {
      expect(normalizeTime(input)).toBeNull();
      expect(isTime(input)).toBe(false);
    },
  );
});

describe("havePrayerTimesChanged", () => {
  const baseline: PrayerTime[] = [
    { prayer: "Fajr", jamaat: "05:30" },
    { prayer: "Dhuhr", jamaat: "13:45" },
    { prayer: "Asr", jamaat: "16:00" },
    { prayer: "Maghrib", jamaat: "17:25" },
    { prayer: "Isha", jamaat: "19:30" },
  ];

  it("returns false when every jamaat time is unchanged", () => {
    expect(havePrayerTimesChanged(baseline, baseline)).toBe(false);
  });

  it("returns true when any jamaat time changes", () => {
    const changed = baseline.map((item) =>
      item.prayer === "Asr" ? { ...item, jamaat: "16:15" } : item,
    );

    expect(havePrayerTimesChanged(changed, baseline)).toBe(true);
  });
});
