import { describe, expect, it } from "vitest";
import {
  buildCompactBilingualNotification,
  buildPrayerChangeNotification,
  buildPrayerChangeNotificationBody,
  notificationForLocale,
} from "@/lib/prayer-change-notification";

const fajrChange = { prayer: "Fajr" as const, oldJamaat: "05:30", newJamaat: "05:15" };

describe("buildPrayerChangeNotificationBody", () => {
  it("includes the effective date for one changed prayer", () => {
    expect(buildPrayerChangeNotificationBody("2026-11-01", [fajrChange])).toBe(
      "Fajr jamaat: 5:30 AM → 5:15 AM, effective 1 November 2026.",
    );
  });

  it("includes the effective date for multiple changed prayers", () => {
    expect(
      buildPrayerChangeNotificationBody("2026-11-01", [
        fajrChange,
        { prayer: "Isha", oldJamaat: "19:30", newJamaat: "19:45" },
      ]),
    ).toBe("2 jamaat times were updated, effective 1 November 2026.");
  });
});

describe("notification locales", () => {
  it("builds an Urdu alert for a single change", () => {
    const notification = buildPrayerChangeNotification("ur", "2026-11-01", [fajrChange]);
    expect(notification.title).toBe("جماعت کا وقت تبدیل");
    expect(notification.body).toContain("فجر جماعت");
    expect(notification.body).toContain("5:30 AM → 5:15 AM");
  });

  it("uses English or Urdu when the saved locale is known", () => {
    expect(notificationForLocale("en", "2026-11-01", [fajrChange]).title).toBe(
      "Jamaat time changed",
    );
    expect(notificationForLocale("ur", "2026-11-01", [fajrChange]).title).toBe(
      "جماعت کا وقت تبدیل",
    );
  });

  it("falls back to a compact bilingual alert when locale is missing", () => {
    const notification = buildCompactBilingualNotification("2026-11-01", [fajrChange]);
    expect(notificationForLocale(null, "2026-11-01", [fajrChange])).toEqual(notification);
    expect(notification.title).toContain("Jamaat time changed");
    expect(notification.title).toContain("جماعت کا وقت تبدیل");
    expect(notification.body).toContain("Fajr");
    expect(notification.body).toContain("فجر");
  });
});
