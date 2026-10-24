import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthorizedAdmin } from "@/lib/admin";
import { notifyPrayerChanges } from "@/lib/push";
import {
  createAdminClient,
  SupabaseAdminConfigurationError,
} from "@/lib/supabase/admin";
import { POST } from "@/app/api/admin/schedule/route";

vi.mock("@/lib/admin", () => ({ getAuthorizedAdmin: vi.fn() }));
vi.mock("@/lib/push", () => ({ notifyPrayerChanges: vi.fn() }));
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

const validTimes = [
  { prayer: "Fajr", prayerStart: "05:20", jamaat: "05:45" },
  { prayer: "Dhuhr", prayerStart: "12:30", jamaat: "13:15" },
  { prayer: "Asr", prayerStart: "15:45", jamaat: "16:00" },
  { prayer: "Maghrib", prayerStart: "17:35", jamaat: "17:40" },
  { prayer: "Isha", prayerStart: "19:00", jamaat: "19:15" },
];

function request(body: unknown) {
  return new Request("http://localhost/api/admin/schedule", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/schedule", () => {
  beforeEach(() => {
    vi.mocked(getAuthorizedAdmin).mockResolvedValue({ email: "imam@example.org" } as never);
  });

  it("rejects unauthenticated requests before accessing the database", async () => {
    vi.mocked(getAuthorizedAdmin).mockResolvedValue(null);

    const response = await POST(request({ date: "2026-10-24", times: validTimes }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Authorized editor access is required.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns structured JSON when the server secret is missing", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new SupabaseAdminConfigurationError();
    });

    const response = await POST(request({ date: "2026-10-24", times: validTimes }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Server setup is incomplete. Add the Supabase secret key and restart the app.",
    });
  });

  it("publishes the exact schedule payload and reports notifications", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ prayer: "Asr", oldJamaat: "16:15", newJamaat: "16:00" }],
      error: null,
    });
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);
    vi.mocked(notifyPrayerChanges).mockResolvedValue(3);

    const response = await POST(request({ date: "2026-10-24", times: validTimes }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, changed: 1, notified: 3 });
    expect(rpc).toHaveBeenCalledWith("publish_prayer_schedule", {
      p_date: "2026-10-24",
      p_times: validTimes.map((time) => ({
        prayer: time.prayer,
        prayer_start: time.prayerStart,
        jamaat: time.jamaat,
      })),
      p_changed_by: "imam@example.org",
    });
    expect(notifyPrayerChanges).toHaveBeenCalledWith("2026-10-24", [
      { prayer: "Asr", oldJamaat: "16:15", newJamaat: "16:00" },
    ]);
  });
});
