import { describe, expect, it } from "vitest";
import {
  displayTime,
  findNextJamaat,
  minutesInTimezone,
  splitTime,
  toMinutes,
} from "@/lib/jamaat-time";
import type { PrayerTime } from "@/lib/prayers";

const TIMES: PrayerTime[] = [
  { prayer: "Fajr", jamaat: "05:30" },
  { prayer: "Dhuhr", jamaat: "13:45" },
  { prayer: "Asr", jamaat: "16:00" },
  { prayer: "Maghrib", jamaat: "17:25" },
  { prayer: "Isha", jamaat: "19:30" },
  { prayer: "Jumu'ah", jamaat: "13:15" },
];

describe("time formatting", () => {
  it("converts HH:MM to minutes", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("17:25")).toBe(1045);
  });

  it("formats wall-clock time without timezone drift", () => {
    expect(displayTime("05:30")).toBe("5:30 AM");
    expect(displayTime("17:25")).toBe("5:25 PM");
    expect(splitTime("17:25")).toEqual({ value: "5:25", suffix: "PM" });
  });
});

describe("minutesInTimezone", () => {
  it("reads the wall clock in the mosque's timezone", () => {
    const instant = new Date("2026-11-07T12:00:00Z");
    expect(minutesInTimezone("Asia/Karachi", instant)).toBe(17 * 60);
    expect(minutesInTimezone("UTC", instant)).toBe(12 * 60);
  });
});

describe("findNextJamaat", () => {
  it("returns the next daily jamaat later today", () => {
    expect(findNextJamaat(TIMES, toMinutes("14:00"))).toEqual({
      prayer: "Asr",
      jamaat: "16:00",
      isTomorrow: false,
      remainingMinutes: 120,
    });
  });

  it("ignores Jumu'ah", () => {
    expect(findNextJamaat(TIMES, toMinutes("13:00"))?.prayer).toBe("Dhuhr");
  });

  it("rolls over to tomorrow's Fajr after Isha", () => {
    expect(findNextJamaat(TIMES, toMinutes("21:00"))).toEqual({
      prayer: "Fajr",
      jamaat: "05:30",
      isTomorrow: true,
      remainingMinutes: 8 * 60 + 30,
    });
  });

  it("treats a jamaat at the current minute as already started", () => {
    expect(findNextJamaat(TIMES, toMinutes("16:00"))?.prayer).toBe("Maghrib");
  });

  it("returns null without daily times", () => {
    expect(findNextJamaat([{ prayer: "Jumu'ah", jamaat: "13:15" }], 0)).toBeNull();
  });
});
