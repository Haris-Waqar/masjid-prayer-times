export type AdminRole = "admin" | "super_admin";

export type AdminAccess = {
  userId: string;
  email: string;
  membershipId: string;
  role: AdminRole;
  passwordSetupRequired: boolean;
};

export function canEditSchedule(access: AdminAccess | null) {
  return Boolean(access && !access.passwordSetupRequired);
}

export function canManageAdmins(access: AdminAccess | null) {
  return Boolean(
    access?.role === "super_admin" && !access.passwordSetupRequired,
  );
}
