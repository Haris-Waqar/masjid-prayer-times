import { expect, test } from "@playwright/test";
import { regularAdmin, setupAdmin, signIn } from "./fixtures/auth";

test("a temporary password cannot reach the timetable editor", async ({
  page,
}) => {
  const credentials = setupAdmin();
  test.skip(
    !credentials,
    "Set E2E_SETUP_EMAIL and E2E_SETUP_PASSWORD to run the setup gate.",
  );
  if (!credentials) return;
  test.setTimeout(60_000);

  await signIn(page, credentials);
  await expect(page).toHaveURL(/\/admin\/reset-password\?setup=required/);
  await expect(
    page.getByRole("heading", { name: "Choose a new password" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Update jamaat times" }),
  ).toHaveCount(0);
});

test("posting a jamaat change requires an explicit confirmation", async ({
  page,
}) => {
  const credentials = regularAdmin();
  test.skip(
    !credentials,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for a regular administrator.",
  );
  if (!credentials) return;
  test.setTimeout(60_000);

  let posted:
    | { date?: string; times?: Array<{ prayer?: string; jamaat?: string }> }
    | undefined;
  await page.route("**/api/admin/schedule", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    posted = route.request().postDataJSON() as typeof posted;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, changed: 1, notified: 0 }),
    });
  });

  await signIn(page, credentials);
  await expect(
    page.getByRole("heading", { name: "Update jamaat times" }),
  ).toBeVisible();

  const fajr = page.locator("#Fajr-jamaat");
  const current = await fajr.inputValue();
  const nextJamaat = current === "05:31" ? "05:32" : "05:31";
  await fajr.fill(nextJamaat);
  await page.getByRole("button", { name: "Review and post" }).click();

  const review = page.getByRole("dialog", { name: "Post these jamaat times?" });
  await expect(review).toBeVisible();
  await expect(review.getByText("Changed", { exact: true })).toBeVisible();
  expect(posted).toBeUndefined();

  await review.getByRole("button", { name: "Post jamaat times" }).click();

  await expect(
    page.getByText("Posted 1 change. 0 subscribed devices were notified."),
  ).toBeVisible();
  expect(posted?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(posted?.times).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ prayer: "Fajr", jamaat: nextJamaat }),
    ]),
  );
});

test("a regular administrator cannot open management or its APIs", async ({
  page,
}) => {
  const credentials = regularAdmin();
  test.skip(
    !credentials,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for a regular administrator.",
  );
  if (!credentials) return;
  test.setTimeout(60_000);

  await signIn(page, credentials);
  await expect(
    page.getByRole("heading", { name: "Update jamaat times" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage" })).toHaveCount(0);

  await page.goto("/admin/manage");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Update jamaat times" }),
  ).toBeVisible();

  const overview = await page.request.get("/api/admin/overview");
  expect(overview.status()).toBe(403);
  await expect(overview.json()).resolves.toEqual({
    error: "Super administrator access is required.",
  });

  const creation = await page.request.post("/api/admin/admins", {
    data: { email: "nobody@example.org" },
  });
  expect(creation.status()).toBe(403);
});
