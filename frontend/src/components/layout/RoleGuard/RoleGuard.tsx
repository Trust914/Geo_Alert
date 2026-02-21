import { Navigate } from "react-router-dom";
import { useBFF } from "../../../features/bff_auth/context";
import { isSuperAdmin } from "../../../features/users/utils/";
import { AccessDeniedPage } from "../../pages";
import type { UserRole } from "../../../types";
import type { ISafeUser } from "../../../features/users/types";

interface RoleGuardProps {
  allowedRoles?: UserRole[]
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
  fallback?: React.ReactNode;
}

export function RoleGuard({ children, allowedRoles, requireSuperAdmin = false, fallback }: RoleGuardProps) {
  const { user, isAuthenticated } = useBFF();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const hasSuperAdminAccess = isSuperAdmin(user as ISafeUser);
  const hasRequiredRole = allowedRoles ? allowedRoles.includes(user.role) : true;

  // If super admin is required, check it. Otherwise, check role.
  const isAuthorized = requireSuperAdmin ? hasSuperAdminAccess : hasRequiredRole;

  if (!isAuthorized) {
    return fallback ? <>{fallback}</> : <AccessDeniedPage />;
  }

  return <>{children}</>;
}