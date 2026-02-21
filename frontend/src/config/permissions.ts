import { UserRole } from "../types/enums.types";

export const PERMISSIONS = {
  // Alert permissions
  ALERT_CREATE: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.OPERATOR],
  ALERT_SEND: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.OPERATOR],
  ALERT_CANCEL: [UserRole.ADMIN, UserRole.COORDINATOR],
  ALERT_VIEW: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.OPERATOR, UserRole.VIEWER],

  // User management
  USER_CREATE: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  USER_EDIT: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  USER_DELETE: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  USER_VIEW: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COORDINATOR],

  // Agency management
  AGENCY_CREATE: [UserRole.SUPER_ADMIN],
  AGENCY_EDIT: [UserRole.SUPER_ADMIN],
  AGENCY_DELETE: [UserRole.SUPER_ADMIN],
  AGENCY_VIEW: [UserRole.SUPER_ADMIN, UserRole.ADMIN],

  // Citizen management
  CITIZEN_VIEW: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.OPERATOR, UserRole.VIEWER],
  CITIZEN_EDIT: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.OPERATOR],

  // Audit logs
  AUDIT_VIEW_ALL: [UserRole.SUPER_ADMIN],
  AUDIT_VIEW_AGENCY: [UserRole.ADMIN, UserRole.COORDINATOR],
} as const;

export function hasPermission(userRole: UserRole, permission: keyof typeof PERMISSIONS): boolean {
  const allowedRoles = PERMISSIONS[permission] as readonly UserRole[];
  return allowedRoles.includes(userRole);
}

export function canAccessRoute(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole);
}
