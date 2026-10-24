import { expect, test } from "@playwright/test";

test("public timetable renders the mosque and five prayers", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Jamia Masjid Fazaia Town", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prayer timetable" })).toBeVisible();
  for (const prayer of ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]) {
    await expect(page.getByText(prayer, { exact: true })).toBeVisible();
  }
});

test("admin without a session is redirected to sign in", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Imam and editor sign in" })).toBeVisible();
});

test("schedule API rejects an unauthenticated write with JSON", async ({ request }) => {
  const response = await request.post("/api/admin/schedule", {
    data: {
      date: "2026-10-24",
      times: [
        { prayer: "Fajr", prayerStart: "05:20", jamaat: "05:45" },
        { prayer: "Dhuhr", prayerStart: "12:30", jamaat: "13:15" },
        { prayer: "Asr", prayerStart: "15:45", jamaat: "16:00" },
        { prayer: "Maghrib", prayerStart: "17:35", jamaat: "17:40" },
        { prayer: "Isha", prayerStart: "19:00", jamaat: "19:15" },
      ],
    },
  });

  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toEqual({
    error: "Authorized editor access is required.",
  });
});
