import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminSession } from "@/lib/admin";
import {
  setRegularAdminMosqueAssignment,
  setRegularAdminMosqueManagement,
} from "@/lib/admin-management";
import { PATCH as UPDATE_MANAGEMENT } from "@/app/api/admin/admins/[id]/masjid-management/route";
import {
  DELETE as REMOVE_ASSIGNMENT,
  PUT as ADD_ASSIGNMENT,
} from "@/app/api/admin/admins/[id]/masjids/[mosqueId]/route";

vi.mock("@/lib/admin", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/lib/admin-management", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/admin-management")>();
  return {
    ...original,
    setRegularAdminMosqueAssignment: vi.fn(),
    setRegularAdminMosqueManagement: vi.fn(),
  };
});

const adminId = "11111111-1111-4111-8111-111111111111";
const mosqueId = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ id: adminId, mosqueId }) };
const superAdminAccess = {
  userId: "actor-user",
  membershipId: "actor-member",
  email: "boss@example.org",
  role: "super_admin" as const,
  canManageMasjids: true,
  assignedMosqueIds: [],
  assignedMosques: [],
  passwordSetupRequired: false,
};
const superAdminSession = {
  user: { id: "actor-user" },
  access: superAdminAccess,
};

describe("admin masjid permission routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminSession).mockResolvedValue(superAdminSession as never);
  });

  it("allows only a super administrator to delegate mosque management", async () => {
    const response = await UPDATE_MANAGEMENT(
      new Request(`http://localhost/api/admin/admins/${adminId}/masjid-management`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      }),
      { params: Promise.resolve({ id: adminId }) },
    );
    expect(response.status).toBe(200);
    expect(setRegularAdminMosqueManagement).toHaveBeenCalledWith(
      adminId,
      true,
      "actor-user",
    );

    vi.mocked(getAdminSession).mockResolvedValueOnce({
      user: { id: "regular-user" },
      access: { ...superAdminAccess, role: "admin" },
    } as never);
    const denied = await UPDATE_MANAGEMENT(
      new Request(`http://localhost/api/admin/admins/${adminId}/masjid-management`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: true }),
      }),
      { params: Promise.resolve({ id: adminId }) },
    );
    expect(denied.status).toBe(403);
  });

  it("adds and removes a mosque assignment independently", async () => {
    const add = await ADD_ASSIGNMENT(
      new Request("http://localhost", { method: "PUT" }),
      context,
    );
    const remove = await REMOVE_ASSIGNMENT(
      new Request("http://localhost", { method: "DELETE" }),
      context,
    );
    expect(add.status).toBe(200);
    expect(remove.status).toBe(200);
    expect(setRegularAdminMosqueAssignment).toHaveBeenNthCalledWith(
      1,
      adminId,
      mosqueId,
      true,
      "actor-user",
    );
    expect(setRegularAdminMosqueAssignment).toHaveBeenNthCalledWith(
      2,
      adminId,
      mosqueId,
      false,
      "actor-user",
    );
  });

  it("rejects a non-object management payload cleanly", async () => {
    const response = await UPDATE_MANAGEMENT(
      new Request(`http://localhost/api/admin/admins/${adminId}/masjid-management`, {
        method: "PATCH",
        body: "null",
      }),
      { params: Promise.resolve({ id: adminId }) },
    );
    expect(response.status).toBe(400);
    expect(setRegularAdminMosqueManagement).not.toHaveBeenCalled();
  });
});
