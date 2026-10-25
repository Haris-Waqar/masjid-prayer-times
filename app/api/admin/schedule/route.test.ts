import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAdminSession } from "@/lib/admin";
import { notifyPrayerChanges } from "@/lib/push";
import type { PrayerTime } from "@/lib/prayers";
import { getPrayerSchedule, getSettings } from "@/lib/schedule";
import {
  createAdminClient,
  SupabaseAdminConfigurationError,
} from "@/lib/supabase/admin";
import { GET, POST } from "@/app/api/admin/schedule/route";

vi.mock("@/lib/admin", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/lib/push", () => ({ notifyPrayerChanges: vi.fn() }));
vi.mock("@/lib/schedule", () => ({
  getPrayerSchedule: vi.fn(),
  getSettings: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => {
  class MockSupabaseAdminConfigurationError extends Error {
    constructor() {
      super("Supabase server credentials are not configured.");
      this.name = "SupabaseAdminConfigurationError";
    }
  }

  return {
    createAdminClient: vi.fn(),
    SupabaseAdminConfigurationError: MockSupabaseAdminConfigurationError,
  };
});

const validTimes: PrayerTime[] = [
  { prayer: "Fajr", jamaat: "05:30" },
  { prayer: "Dhuhr", jamaat: "13:45" },
  { prayer: "Asr", jamaat: "16:00" },
  { prayer: "Maghrib", jamaat: "17:25" },
  { prayer: "Isha", jamaat: "19:30" },
  { prayer: "Jumu'ah", jamaat: "13:45" },
];
const futureDate = "2099-10-24";
const adminSession = {
  user: { id: "user-1", email: "imam@example.org" },
  access: {
    userId: "user-1",
    email: "imam@example.org",
    membershipId: "member-1",
    role: "admin",
    passwordSetupRequired: false,
  },
} as never;

function request(body: unknown) {
  return new Request("http://localhost/api/admin/schedule", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminSession).mockResolvedValue(adminSession);
    vi.mocked(getSettings).mockResolvedValue({
      timezone: "Asia/Karachi",
    } as never);
  });

  it("rejects unauthenticated requests before accessing the database", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ user: null, access: null });

    const response = await POST(
      request({ date: futureDate, times: validTimes }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sign in is required.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns structured JSON when the server secret is missing", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new SupabaseAdminConfigurationError();
    });

    const response = await POST(
      request({ date: futureDate, times: validTimes }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error:
        "Server setup is incomplete. Add the Supabase secret key and restart the app.",
    });
  });

  it("publishes the exact schedule payload and reports notifications", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ prayer: "Asr", oldJamaat: "16:15", newJamaat: "16:00" }],
      error: null,
    });
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);
    vi.mocked(notifyPrayerChanges).mockResolvedValue(3);

    const response = await POST(
      request({ date: futureDate, times: validTimes }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      changed: 1,
      notified: 3,
    });
    expect(rpc).toHaveBeenCalledWith("publish_prayer_schedule", {
      p_date: futureDate,
      p_times: validTimes.map((time) => ({
        prayer: time.prayer,
        jamaat: time.jamaat,
      })),
      p_changed_by: "imam@example.org",
    });
    expect(notifyPrayerChanges).toHaveBeenCalledWith(futureDate, [
      { prayer: "Asr", oldJamaat: "16:15", newJamaat: "16:00" },
    ]);
    expect(revalidateTag).toHaveBeenCalledWith("prayer-schedules", {
      expire: 0,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "page");
  });

  it("normalizes Supabase time values before publishing", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);
    vi.mocked(notifyPrayerChanges).mockResolvedValue(0);
    const databaseTimes = validTimes.map((time, index) => ({
      ...time,
      jamaat: index === 4 ? "19:15" : `${time.jamaat}:00`,
    }));

    const response = await POST(
      request({ date: futureDate, times: databaseTimes }),
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("publish_prayer_schedule", {
      p_date: futureDate,
      p_times: [
        { prayer: "Fajr", jamaat: "05:30" },
        { prayer: "Dhuhr", jamaat: "13:45" },
        { prayer: "Asr", jamaat: "16:00" },
        { prayer: "Maghrib", jamaat: "17:25" },
        { prayer: "Isha", jamaat: "19:15" },
        { prayer: "Jumu'ah", jamaat: "13:45" },
      ],
      p_changed_by: "imam@example.org",
    });
  });

  it("rejects past effective dates before publishing", async () => {
    const response = await POST(
      request({ date: "2000-01-01", times: validTimes }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Choose today or a future effective date.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects schedules that omit Jumu'ah", async () => {
    const response = await POST(
      request({
        date: futureDate,
        times: validTimes.filter((time) => time.prayer !== "Jumu'ah"),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "All five daily jamaat times and Jumu'ah are required.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminSession).mockResolvedValue(adminSession);
    vi.mocked(getSettings).mockResolvedValue({
      timezone: "Asia/Karachi",
    } as never);
  });

  it("loads the timetable applicable to the selected date", async () => {
    vi.mocked(getPrayerSchedule).mockResolvedValue({
      times: validTimes,
      isPublished: true,
    });

    const response = await GET(
      new Request(`http://localhost/api/admin/schedule?date=${futureDate}`),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      date: futureDate,
      times: validTimes,
    });
    expect(getPrayerSchedule).toHaveBeenCalledWith(futureDate);
  });

  it("rejects unauthenticated reads", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ user: null, access: null });

    const response = await GET(
      new Request(`http://localhost/api/admin/schedule?date=${futureDate}`),
    );

    expect(response.status).toBe(401);
    expect(getPrayerSchedule).not.toHaveBeenCalled();
  });

  it("rejects invalid calendar dates", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/schedule?date=2099-02-30"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Choose a valid effective date.",
    });
    expect(getPrayerSchedule).not.toHaveBeenCalled();
  });
});
