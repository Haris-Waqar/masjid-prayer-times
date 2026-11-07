export type AdminRole = "admin" | "super_admin";

export type AdminMosque = {
  id: string;
  slug: string;
  name: string;
  location: string;
  timezone: string;
};

export type AdminAccess = {
  userId: string;
  email: string;
  membershipId: string;
  role: AdminRole;
  canManageMasjids: boolean;
  assignedMosqueIds: string[];
  assignedMosques: AdminMosque[];
  passwordSetupRequired: boolean;
};

export function canEditSchedule(access: AdminAccess | null) {
  return Boolean(
    access &&
      !access.passwordSetupRequired &&
      (access.role === "super_admin" ||
        (access.assignedMosqueIds?.length ?? 0) > 0),
  );
}

export function canEditMosque(
  access: AdminAccess | null,
  mosqueId: string,
  mosqueActive = true,
) {
  return Boolean(
    mosqueActive &&
      access &&
      !access.passwordSetupRequired &&
      (access.role === "super_admin" ||
        access.assignedMosqueIds?.includes(mosqueId)),
  );
}

export function canManageMasjids(access: AdminAccess | null) {
  return Boolean(
    access &&
      !access.passwordSetupRequired &&
      (access.role === "super_admin" || access.canManageMasjids),
  );
}

export function canManageAdmins(access: AdminAccess | null) {
  return Boolean(
    access?.role === "super_admin" && !access.passwordSetupRequired,
  );
}
