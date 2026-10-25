import { describe, expect, it } from "vitest";
import {
  canEditSchedule,
  canManageAdmins,
  type AdminAccess,
} from "@/lib/admin-policy";

function access(overrides: Partial<AdminAccess> = {}): AdminAccess {
  return {
    userId: "user-1",
    membershipId: "member-1",
    email: "admin@example.org",
    role: "admin",
    passwordSetupRequired: false,
    ...overrides,
  };
}

describe("admin policy", () => {
  it("allows both completed roles to edit the timetable", () => {
    expect(canEditSchedule(access())).toBe(true);
    expect(canEditSchedule(access({ role: "super_admin" }))).toBe(true);
  });

  it("allows only a completed super admin to manage administrators", () => {
    expect(canManageAdmins(access())).toBe(false);
    expect(canManageAdmins(access({ role: "super_admin" }))).toBe(true);
  });

  it("blocks all admin access while password setup is required", () => {
    const pending = access({
      role: "super_admin",
      passwordSetupRequired: true,
    });
    expect(canEditSchedule(pending)).toBe(false);
    expect(canManageAdmins(pending)).toBe(false);
  });
});
