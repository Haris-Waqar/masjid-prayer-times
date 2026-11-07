import { describe, expect, it } from "vitest";
import {
  canEditMosque,
  canEditSchedule,
  canManageAdmins,
  canManageMasjids,
  type AdminAccess,
} from "@/lib/admin-policy";

function access(overrides: Partial<AdminAccess> = {}): AdminAccess {
  return {
    userId: "user-1",
    membershipId: "member-1",
    email: "admin@example.org",
    role: "admin",
    canManageMasjids: false,
    assignedMosqueIds: ["mosque-1"],
    assignedMosques: [],
    passwordSetupRequired: false,
    ...overrides,
  };
}

describe("admin policy", () => {
  it("allows both completed roles to edit the timetable", () => {
    expect(canEditSchedule(access())).toBe(true);
    expect(canEditSchedule(access({ role: "super_admin" }))).toBe(true);
  });

  it("requires a regular administrator to have a matching mosque assignment", () => {
    expect(canEditMosque(access(), "mosque-1")).toBe(true);
    expect(canEditMosque(access(), "mosque-2")).toBe(false);
    expect(
      canEditSchedule(access({ assignedMosqueIds: [] })),
    ).toBe(false);
  });

  it("allows the super administrator to edit every active mosque", () => {
    const owner = access({ role: "super_admin", assignedMosqueIds: [] });
    expect(canEditMosque(owner, "mosque-2")).toBe(true);
    expect(canEditMosque(owner, "mosque-2", false)).toBe(false);
  });

  it("allows only a completed super admin to manage administrators", () => {
    expect(canManageAdmins(access())).toBe(false);
    expect(canManageAdmins(access({ role: "super_admin" }))).toBe(true);
  });

  it("allows delegated mosque management without administrator management", () => {
    const delegated = access({ canManageMasjids: true });
    expect(canManageMasjids(delegated)).toBe(true);
    expect(canManageAdmins(delegated)).toBe(false);
    expect(canManageMasjids(access({ role: "super_admin" }))).toBe(true);
  });

  it("blocks all admin access while password setup is required", () => {
    const pending = access({
      role: "super_admin",
      passwordSetupRequired: true,
    });
    expect(canEditSchedule(pending)).toBe(false);
    expect(canEditMosque(pending, "mosque-1")).toBe(false);
    expect(canManageMasjids(pending)).toBe(false);
    expect(canManageAdmins(pending)).toBe(false);
  });
});
