import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminSession } from "@/lib/admin";
import { loadAdminOverview } from "@/lib/admin-management";
import { SupabaseAdminConfigurationError } from "@/lib/supabase/admin";
import { GET } from "@/app/api/admin/overview/route";

vi.mock("@/lib/admin", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/lib/admin-management", () => ({ loadAdminOverview: vi.fn() }));

const request = new Request("http://localhost/api/admin/overview");

const overview = {
  admins: [
    {
      id: "member-1",
      email: "boss@example.org",
      role: "super_admin" as const,
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  statistics: {
    totalDevices: 4,
    englishDevices: 3,
    urduDevices: 1,
    devicesCreatedLast30Days: 2,
    devicesRefreshedLast30Days: 3,
    activeAdmins: 1,
    timetableChangesLast30Days: 6,
    latestTimetableChange: "2026-10-20T12:00:00.000Z",
    updatedAt: "2026-10-25T08:00:00.000Z",
  },
};

function session(role: "admin" | "super_admin", passwordSetupRequired = false) {
  return {
    user: { id: "user-1", email: "person@example.org" },
    access: {
      userId: "user-1",
      email: "person@example.org",
      membershipId: "member-1",
      role,
      passwordSetupRequired,
    },
  } as never;
}

describe("GET /api/admin/overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadAdminOverview).mockResolvedValue(overview);
  });

  it("returns aggregate statistics without subscription secrets", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(session("super_admin"));

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toEqual({ ok: true, ...overview });
    expect(JSON.stringify(body)).not.toMatch(/endpoint|p256dh|auth|secret/i);
    expect(loadAdminOverview).toHaveBeenCalledOnce();
  });

  it("rejects a signed-out caller before loading statistics", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ user: null, access: null });

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Sign in is required.",
    });
    expect(loadAdminOverview).not.toHaveBeenCalled();
  });

  it("rejects a regular administrator and a super administrator who still needs setup", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(session("admin"));
    const regular = await GET(request);
    expect(regular.status).toBe(403);
    await expect(regular.json()).resolves.toEqual({
      error: "Super administrator access is required.",
    });

    vi.mocked(getAdminSession).mockResolvedValue(
      session("super_admin", true),
    );
    const pending = await GET(request);
    expect(pending.status).toBe(403);
    expect(loadAdminOverview).not.toHaveBeenCalled();
  });

  it("reports incomplete server setup separately from an unexpected failure", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(session("super_admin"));
    vi.mocked(loadAdminOverview).mockRejectedValueOnce(
      new SupabaseAdminConfigurationError(),
    );
    const unconfigured = await GET(request);
    expect(unconfigured.status).toBe(503);
    await expect(unconfigured.json()).resolves.toEqual({
      error:
        "Server setup is incomplete. Please contact the site administrator.",
    });

    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(loadAdminOverview).mockRejectedValueOnce(new Error("db down"));
    const failed = await GET(request);
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({
      error: "The management overview could not be loaded.",
    });
    expect(errorLog).toHaveBeenCalledWith(
      "Admin operation failed",
      expect.objectContaining({
        operation: "load_overview",
        method: "GET",
        path: "/api/admin/overview",
      }),
    );
    errorLog.mockRestore();
  });
});
