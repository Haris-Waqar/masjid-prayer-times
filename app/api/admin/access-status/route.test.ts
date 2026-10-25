import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminSession } from "@/lib/admin";
import { GET } from "@/app/api/admin/access-status/route";

vi.mock("@/lib/admin", () => ({ getAdminSession: vi.fn() }));

const request = new Request("http://localhost/api/admin/access-status");

describe("GET /api/admin/access-status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns setup status for an active administrator", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({
      user: { id: "user-1" },
      access: {
        userId: "user-1",
        membershipId: "member-1",
        email: "admin@example.org",
        role: "admin",
        passwordSetupRequired: true,
      },
    } as never);
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      passwordSetupRequired: true,
    });
  });

  it("distinguishes missing authentication from revoked access", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ user: null, access: null });
    expect((await GET(request)).status).toBe(401);

    vi.mocked(getAdminSession).mockResolvedValue({
      user: { id: "user-1" },
      access: null,
    } as never);
    const revoked = await GET(request);
    expect(revoked.status).toBe(403);
    await expect(revoked.json()).resolves.toEqual({
      error:
        "Administrator access is inactive or has been revoked. Contact the super administrator.",
    });
  });
});
