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
  await expect(timetable.getByRole("time")).toHaveCount(5);
  await expect(timetable.getByRole("time").first()).toHaveText(/^\d{1,2}:\d{2} [AP]M$/);
});

test("admin without a session is redirected to sign in", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Imam and editor sign in" })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
  await expect(page.getByText(/secure sign-in link/i)).toHaveCount(0);
});

test("password sign-in sends credentials to Supabase without requesting email", async ({ page }) => {
  let requestBody: { email?: string; password?: string } | undefined;
  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    requestBody = route.request().postDataJSON() as typeof requestBody;
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }),
    });
  });
  await page.goto("/admin/login");

  await page.getByLabel("Authorized email").fill("imam@example.org");
  await page.getByLabel("Password", { exact: true }).fill("not-the-real-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("The email or password is incorrect.")).toBeVisible();
  expect(requestBody).toMatchObject({
    email: "imam@example.org",
    password: "not-the-real-password",
  });
});

test("password recovery uses the dedicated reset flow", async ({ page }) => {
  let redirectTo = "";
  await page.route("**/auth/v1/recover**", async (route) => {
    redirectTo = new URL(route.request().url()).searchParams.get("redirect_to") ?? "";
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto("/admin/forgot-password");

  await page.getByLabel("Authorized email").fill("imam@example.org");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByText(/if this address has an editor account/i)).toBeVisible();
  expect(redirectTo).toContain("/auth/callback?next=/admin/reset-password");
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
