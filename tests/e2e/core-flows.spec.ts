import { expect, test } from "@playwright/test";

test("public timetable renders the mosque and today's prayers", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Choose your masjid" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View timetable" }).click();
  await expect(page).toHaveURL(/\/masjids\/fazaia-town$/);

  await expect(
    page.locator(".brand-name", {
      hasText: "Jamia Masjid Fazaia Housing",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Today's jamaat times" }),
  ).toBeVisible();
  const timetable = page.getByRole("list");
  const expectedPrayers = [
    "Fajr",
    "Dhuhr",
    "Asr",
    "Maghrib",
    "Isha",
    "Jumu'ah",
  ];
  for (const prayer of expectedPrayers) {
    await expect(timetable.getByText(prayer, { exact: true })).toBeVisible();
  }
  await expect(timetable.getByText("Friday", { exact: true })).toBeVisible();
  await expect(page.getByText("Begins", { exact: true })).toHaveCount(0);
  const publishedTimes = timetable.getByRole("time");
  const publishedCount = await publishedTimes.count();
  expect([0, expectedPrayers.length]).toContain(publishedCount);
  if (publishedCount > 0) {
    await expect(publishedTimes.first()).toHaveText(/^\d{1,2}:\d{2} [AP]M$/);
  } else {
    await expect(
      page.getByText("No times are shown until they are posted."),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: "Refresh times" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Update times" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveAttribute(
    "href",
    "/admin",
  );
  await expect
    .poll(() =>
      page
        .locator(".next-prayer-panel")
        .evaluate((element) => getComputedStyle(element, "::after").content),
    )
    .toBe("none");
});

test("admin route opens sign in without a loading shell", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.locator(".loading-shell")).toHaveCount(0);
});

test("an existing push subscription remains enabled after reopening", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const registration = {
      pushManager: {
        getSubscription: async () => ({
          endpoint: "https://fcm.googleapis.com/fcm/send/subscription",
          unsubscribe: async () => true,
        }),
      },
    };
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManager() {},
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "granted" },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: async () => registration,
        ready: Promise.resolve(registration),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });

  await page.route("**/api/push/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, subscribed: true }),
    });
  });
  await page.goto("/masjids/fazaia-town");

  await expect(
    page.getByRole("button", { name: "Notify me if jamaat changes" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Disable alerts" }),
  ).toBeVisible();
});

test("manual refresh shows progress and confirmation", async ({ page }) => {
  await page.route("**/?refresh=*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.continue();
  });
  await page.goto("/masjids/fazaia-town");

  await page.getByRole("button", { name: "Refresh times" }).click();

  await expect(
    page.getByRole("button", { name: "Refreshing times" }),
  ).toBeDisabled();
  await expect(page.getByText("Refreshing times…")).toBeVisible();
  await expect(page.getByText("Jamaat times refreshed.")).toBeVisible();
});

test("a push update refreshes the visible timetable", async ({ page }) => {
  await page.addInitScript(() => {
    const runtimeWindow = window as typeof window & {
      receiveTimetableMessage?: (event: {
        data: { type: string; url?: string };
      }) => void;
    };
    const registration = {
      pushManager: { getSubscription: async () => null },
    };
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManager() {},
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "default" },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: async () => registration,
        addEventListener: (
          type: string,
          listener: typeof runtimeWindow.receiveTimetableMessage,
        ) => {
          if (type === "message")
            runtimeWindow.receiveTimetableMessage = listener;
        },
        removeEventListener: () => undefined,
      },
    });
  });
  await page.goto("/masjids/fazaia-town");

  await expect
    .poll(() =>
      page.evaluate(() => {
        const runtimeWindow = window as typeof window & {
          receiveTimetableMessage?: unknown;
        };
        return typeof runtimeWindow.receiveTimetableMessage === "function";
      }),
    )
    .toBe(true);

  await page.evaluate(() => {
    const runtimeWindow = window as typeof window & {
      receiveTimetableMessage?: (event: {
        data: { type: string; url?: string };
      }) => void;
    };
    runtimeWindow.receiveTimetableMessage?.({
      data: {
        type: "TIMETABLE_UPDATED",
        url: "/masjids/fazaia-town",
      },
    });
  });

  await expect(
    page.getByText("A jamaat time changed. Times have been refreshed."),
  ).toBeVisible();
});

test("admin without a session is redirected to sign in", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Forgot password?" }),
  ).toBeVisible();
  await expect(page.getByText(/secure sign-in link/i)).toHaveCount(0);
});

test("password sign-in sends credentials to Supabase without requesting email", async ({
  page,
}) => {
  let requestBody: { email?: string; password?: string } | undefined;
  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    requestBody = route.request().postDataJSON() as typeof requestBody;
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "invalid_grant",
        error_description: "Invalid login credentials",
      }),
    });
  });
  await page.goto("/admin/login");

  await page.getByLabel("Authorized email").fill("imam@example.org");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-the-real-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByText("The email or password is incorrect."),
  ).toBeVisible();
  expect(requestBody).toMatchObject({
    email: "imam@example.org",
    password: "not-the-real-password",
  });
});

test("password sign-in explains rate limiting", async ({ page }) => {
  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        code: "over_request_rate_limit",
        message: "Request rate limit reached",
      }),
    });
  });
  await page.goto("/admin/login");

  await page.getByLabel("Authorized email").fill("imam@example.org");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-the-real-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByText(
      "Too many sign-in attempts. Wait a few minutes before trying again.",
    ),
  ).toBeVisible();
});

test("password recovery uses the dedicated reset flow", async ({ page }) => {
  let redirectTo = "";
  await page.route("**/auth/v1/recover**", async (route) => {
    redirectTo =
      new URL(route.request().url()).searchParams.get("redirect_to") ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto("/admin/forgot-password");

  await page.getByLabel("Authorized email").fill("imam@example.org");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByText(/if this address is authorized/i)).toBeVisible();
  expect(redirectTo).toContain("/auth/callback?next=/admin/reset-password");
});

test("schedule API rejects an unauthenticated write with JSON", async ({
  request,
}) => {
  const response = await request.post("/api/admin/schedule", {
    data: {
      mosqueId: "00000000-0000-4000-8000-000000000001",
      date: "2026-10-24",
      times: [
        { prayer: "Fajr", jamaat: "05:30" },
        { prayer: "Dhuhr", jamaat: "13:45" },
        { prayer: "Asr", jamaat: "16:00" },
        { prayer: "Maghrib", jamaat: "17:25" },
        { prayer: "Isha", jamaat: "19:30" },
        { prayer: "Jumu'ah", jamaat: "13:45" },
      ],
    },
  });

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({
    error: "Sign in is required.",
  });
});
