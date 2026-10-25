import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminSession } from "@/lib/admin";
import { AdminConflictError, createRegularAdmin } from "@/lib/admin-management";
import { POST } from "@/app/api/admin/admins/route";

vi.mock("@/lib/admin", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/lib/admin-management", () => ({
  AdminConflictError: class AdminConflictError extends Error {},
  createRegularAdmin: vi.fn(),
}));

const superSession = {
  user: { id: "user-1" },
  access: {
    userId: "user-1",
    email: "owner@example.org",
    membershipId: "member-1",
    role: "super_admin",
    passwordSetupRequired: false,
  },
} as never;

function request(body: unknown) {
  return new Request("http://localhost/api/admin/admins", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/admins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminSession).mockResolvedValue(superSession);
    vi.mocked(createRegularAdmin).mockResolvedValue(undefined);
  });

  it("returns 401 before mutation when signed out", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ user: null, access: null });
    const response = await POST(request({ email: "admin@example.org" }));
    expect(response.status).toBe(401);
    expect(createRegularAdmin).not.toHaveBeenCalled();
  });

  it("rejects a regular administrator", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({
      user: { id: "user-2" },
      access: {
        userId: "user-2",
        email: "admin@example.org",
        membershipId: "member-2",
        role: "admin",
        passwordSetupRequired: false,
      },
    } as never);
    const response = await POST(request({ email: "admin@example.org" }));
    expect(response.status).toBe(403);
    expect(createRegularAdmin).not.toHaveBeenCalled();
  });

  it("normalizes the email and returns a one-time no-store password", async () => {
    const response = await POST(request({ email: " New.Admin@Example.ORG " }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({ ok: true, email: "new.admin@example.org" });
    expect(body.temporaryPassword).toHaveLength(20);
    expect(createRegularAdmin).toHaveBeenCalledWith(
      "new.admin@example.org",
      body.temporaryPassword,
    );
  });

  it("maps duplicate users to 409", async () => {
    vi.mocked(createRegularAdmin).mockRejectedValue(
      new AdminConflictError("duplicate"),
    );
    const response = await POST(request({ email: "admin@example.org" }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "An administrator with this email already exists.",
    });
  });

  it("rejects malformed email without mutation", async () => {
    const response = await POST(request({ email: "not-an-email" }));
    expect(response.status).toBe(400);
    expect(createRegularAdmin).not.toHaveBeenCalled();
  });
});
