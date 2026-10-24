import { expect, test } from "@playwright/test";

test("public timetable renders the mosque and five prayers", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Jamia Masjid Fazaia Town", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prayer timetable" })).toBeVisible();
  for (const prayer of ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]) {
    await expect(page.getByText(prayer, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("Begins", { exact: true })).toHaveCount(0);
  const timetable = page.getByRole("list");
  for (const jamaat of ["5:30 AM", "1:45 PM", "4:00 PM", "5:25 PM", "7:30 PM"]) {
    await expect(timetable.getByText(jamaat, { exact: true })).toBeVisible();
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
        { prayer: "Fajr", jamaat: "05:30" },
        { prayer: "Dhuhr", jamaat: "13:45" },
        { prayer: "Asr", jamaat: "16:00" },
        { prayer: "Maghrib", jamaat: "17:25" },
        { prayer: "Isha", jamaat: "19:30" },
      ],
    },
  });

  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toEqual({
    error: "Authorized editor access is required.",
  });
});
