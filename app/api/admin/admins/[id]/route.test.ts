import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminSession } from "@/lib/admin";
import {
  deleteRegularAdmin,
  ProtectedAdminError,
  setRegularAdminActive,
} from "@/lib/admin-management";
import { DELETE, PATCH } from "@/app/api/admin/admins/[id]/route";

vi.mock("@/lib/admin", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/lib/admin-management", () => ({
  AdminNotFoundError: class AdminNotFoundError extends Error {},
  ProtectedAdminError: class ProtectedAdminError extends Error {},
  deleteRegularAdmin: vi.fn(),
  setRegularAdminActive: vi.fn(),
}));

const session = {
  user: { id: "11111111-1111-4111-8111-111111111111" },
  access: {
    userId: "11111111-1111-4111-8111-111111111111",
    email: "owner@example.org",
    membershipId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    role: "super_admin",
    passwordSetupRequired: false,
  },
};
const target = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function call() {
  return DELETE(
    new Request(`http://localhost/api/admin/admins/${target}`, {
      method: "DELETE",
    }),
    {
      params: Promise.resolve({ id: target }),
    },
  );
}

function patch(active: unknown) {
  return PATCH(
    new Request(`http://localhost/api/admin/admins/${target}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active }),
    }),
    { params: Promise.resolve({ id: target }) },
  );
}

describe("DELETE /api/admin/admins/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminSession).mockResolvedValue(session as never);
    vi.mocked(deleteRegularAdmin).mockResolvedValue(undefined);
  });

  it("permanently deletes a regular administrator by membership ID", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(deleteRegularAdmin).toHaveBeenCalledWith(
      target,
      session.access.userId,
    );
  });

  it("rejects regular administrators", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({
      user: session.user,
      access: { ...session.access, role: "admin" },
    } as never);
    const response = await call();
    expect(response.status).toBe(403);
    expect(deleteRegularAdmin).not.toHaveBeenCalled();
  });

  it("maps protected targets to 403", async () => {
    vi.mocked(deleteRegularAdmin).mockRejectedValue(
      new ProtectedAdminError("protected"),
    );
    const response = await call();
    expect(response.status).toBe(403);
  });
});

describe("PATCH /api/admin/admins/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminSession).mockResolvedValue(session as never);
    vi.mocked(setRegularAdminActive).mockResolvedValue(undefined);
  });

  it.each([true, false])("sets regular-admin access to %s", async (active) => {
    const response = await patch(active);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, active });
    expect(setRegularAdminActive).toHaveBeenCalledWith(
      target,
      active,
      session.access.userId,
    );
  });

  it("rejects invalid state without mutation", async () => {
    const response = await patch("false");
    expect(response.status).toBe(400);
    expect(setRegularAdminActive).not.toHaveBeenCalled();
  });

  it("protects the super-admin membership", async () => {
    vi.mocked(setRegularAdminActive).mockRejectedValue(
      new ProtectedAdminError("protected"),
    );
    const response = await patch(false);
    expect(response.status).toBe(403);
  });
});
