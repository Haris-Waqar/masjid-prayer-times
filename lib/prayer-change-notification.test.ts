import { describe, expect, it } from "vitest";
import { buildPrayerChangeNotificationBody } from "@/lib/prayer-change-notification";

describe("buildPrayerChangeNotificationBody", () => {
  it("includes the effective date for one changed prayer", () => {
    expect(
      buildPrayerChangeNotificationBody("2026-11-01", [
        { prayer: "Fajr", oldJamaat: "05:30", newJamaat: "05:15" },
      ]),
    ).toBe("Fajr jamaat: 5:30 AM → 5:15 AM, effective 1 November 2026.");
  });

  it("includes the effective date for multiple changed prayers", () => {
    expect(
      buildPrayerChangeNotificationBody("2026-11-01", [
        { prayer: "Fajr", oldJamaat: "05:30", newJamaat: "05:15" },
        { prayer: "Isha", oldJamaat: "19:30", newJamaat: "19:45" },
      ]),
    ).toBe("2 jamaat times were updated, effective 1 November 2026.");
  });
});
