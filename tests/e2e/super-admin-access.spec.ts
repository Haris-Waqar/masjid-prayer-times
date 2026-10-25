import { expect, test } from "@playwright/test";

test("signed-out visitors cannot open super-admin management", async ({
  page,
}) => {
  await page.goto("/admin/manage");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("signed-out management API requests are rejected", async ({ request }) => {
  const overview = await request.get("/api/admin/overview");
  expect(overview.status()).toBe(401);
  expect(overview.headers()["cache-control"]).toBe("no-store");

  const creation = await request.post("/api/admin/admins", {
    data: { email: "nobody@example.org" },
  });
  expect(creation.status()).toBe(401);
});
