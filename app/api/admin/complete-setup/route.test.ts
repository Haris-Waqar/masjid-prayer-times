import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminSession } from "@/lib/admin";
import { completeAdminSetup } from "@/lib/admin-management";
import { POST } from "@/app/api/admin/complete-setup/route";

vi.mock("@/lib/admin", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/lib/admin-management", () => ({ completeAdminSetup: vi.fn() }));

const pendingSession = {
  user: { id: "user-1", app_metadata: { must_change_password: true } },
  access: {
    userId: "user-1",
    email: "admin@example.org",
    membershipId: "member-1",
    role: "admin",
    passwordSetupRequired: true,
  },
};

function request(password: unknown) {
  return new Request("http://localhost/api/admin/complete-setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

describe("POST /api/admin/complete-setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminSession).mockResolvedValue(pendingSession as never);
    vi.mocked(completeAdminSetup).mockResolvedValue(undefined);
  });

  it("updates the password before completing setup", async () => {
    const response = await POST(request("a secure passphrase"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(completeAdminSetup).toHaveBeenCalledWith(
      pendingSession.user,
      "a secure passphrase",
    );
  });

  it("rejects weak passwords without provider mutation", async () => {
    const response = await POST(request("too-short"));
    expect(response.status).toBe(400);
    expect(completeAdminSetup).not.toHaveBeenCalled();
  });

  it("rejects callers whose setup is already complete", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({
      user: pendingSession.user,
      access: { ...pendingSession.access, passwordSetupRequired: false },
    } as never);
    const response = await POST(request("a secure passphrase"));
    expect(response.status).toBe(409);
    expect(completeAdminSetup).not.toHaveBeenCalled();
  });
});
