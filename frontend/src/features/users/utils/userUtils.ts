import { Shield, UserCog, Eye, Zap } from "lucide-react";
import type { IUser, IRoleOption, ISafeUser } from "../types/";
import { UserRole } from "../../../types/";
import { AgencyType } from "../../agencies/types";
import { JurisdictionLevel } from "../../alerts/types";

/**
 * Role definitions with icons and descriptions
 */
export const USER_ROLES: IRoleOption[] = [
  {
    value: UserRole.ADMIN,
    label: "Administrator",
    description: "Full agency control and user management",
    icon: Shield,
  },
  {
    value: UserRole.COORDINATOR,
    label: "Coordinator",
    description: "Alert management and coordination",
    icon: UserCog,
  },
  {
    value: UserRole.OPERATOR,
    label: "Operator",
    description: "Create and send alerts",
    icon: Zap,
  },
  {
    value: UserRole.VIEWER,
    label: "Viewer",
    description: "Read-only access to system",
    icon: Eye,
  },
];

/**
 * Get role badge color
 */
export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    [UserRole.ADMIN]: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
    [UserRole.COORDINATOR]: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
    [UserRole.OPERATOR]: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
    [UserRole.VIEWER]: "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400",
    [UserRole.SUPER_ADMIN]: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  };
  return colors[role] || colors[UserRole.VIEWER];
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleOption = USER_ROLES.find((r) => r.value === role);
  return roleOption?.label || role;
}

/**
 * Format user's full name
 */
export function getUserFullName(user: IUser): string {
  return `${user.firstName} ${user.lastName}`;
}

/**
 * Get user initials for avatar
 */
export function getUserInitials(user: IUser): string {
  return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
}

/**
 * Format last login date
 */
export function formatLastLogin(lastLoginAt: Date | null): string {
  if (!lastLoginAt) return "Never";

  const date = new Date(lastLoginAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Get status badge color and text
 */
export function getUserStatusBadge(user: IUser): {
  color: string;
  text: string;
  icon: string;
} {
  if (!user.isActive) {
    return {
      color: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
      text: "Inactive",
      icon: "⭕",
    };
  }

  if (!user.emailVerified) {
    return {
      color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400",
      text: "Pending",
      icon: "⏳",
    };
  }

  return {
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
    text: "Active",
    icon: "✅",
  };
}

/**
 * Check if user can perform action
 */
export function canPerformAction(currentUserRole: UserRole, targetUser: IUser, action: "edit" | "deactivate" | "delete"): boolean {
  // Only admins can perform these actions
  if (currentUserRole !== UserRole.ADMIN && currentUserRole !== UserRole.SUPER_ADMIN) {
    return false;
  }

  // Can't perform actions on yourself (except edit)
  if (action === "deactivate" || action === "delete") {
    // This check should be done with actual user ID comparison in the component
    return true;
  }

  return true;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate name (2-50 characters)
 */
export function isValidName(name: string): boolean {
  return name.trim().length >= 2 && name.trim().length <= 50;
}

/**
 * Get user activity indicator color
 */
export function getActivityIndicatorColor(lastLoginAt: Date | null): string {
  if (!lastLoginAt) return "bg-gray-400";

  const now = new Date();
  const diffMs = now.getTime() - new Date(lastLoginAt).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24) return "bg-emerald-500"; // Active today
  if (diffHours < 168) return "bg-yellow-500"; // Active this week
  return "bg-gray-400"; // Inactive
}

/**
 * Sort users by various criteria
 */
export function sortUsers(users: IUser[], sortBy: "name" | "email" | "role" | "lastLogin" | "createdAt", order: "asc" | "desc" = "asc"): IUser[] {
  const sorted = [...users].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "name":
        comparison = getUserFullName(a).localeCompare(getUserFullName(b));
        break;
      case "email":
        comparison = a.email.localeCompare(b.email);
        break;
      case "role":
        comparison = a.role.localeCompare(b.role);
        break;
      case "lastLogin":
        comparison = (a.lastLoginAt?.getTime() || 0) - (b.lastLoginAt?.getTime() || 0);
        break;
      case "createdAt":
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }

    return order === "asc" ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Filter users by search term
 */
export function filterUsers(users: IUser[], searchTerm: string): IUser[] {
  if (!searchTerm.trim()) return users;

  const term = searchTerm.toLowerCase();
  return users.filter((user) => user.firstName.toLowerCase().includes(term) || user.lastName.toLowerCase().includes(term) || user.email.toLowerCase().includes(term) || user.role.toLowerCase().includes(term));
}

// Check if user is super admin based on backend middleware logic
export const isSuperAdmin = (user: ISafeUser): boolean => {
  if (!user || !user.agency) return false;

  // Get NEMA agency ID (this should be fetched from backend or environment)
  // For now, we'll check the conditions without NEMA ID, but the backend will verify
  const isFederalNationalAdmin = user.role === UserRole.ADMIN && user.agency.type === AgencyType.FEDERAL && user.agency.jurisdictionLevel === JurisdictionLevel.NATIONAL && user.agency.name === "National Emergency Management Agency";

  return isFederalNationalAdmin;
};

// Check if user can view agency details
export const canViewAgency = (user: ISafeUser, agencyId: string): boolean => {
  if (!user) return false;

  // Super admin can view all agencies
  if (isSuperAdmin(user)) return true;

  // Agency admin can only view their own agency
  return user.role === UserRole.ADMIN && user.agencyId === agencyId;
};

// Check if user can edit agency
export const canEditAgency = (user: ISafeUser, agencyId: string): boolean => {
  // Only super admin can edit agencies
  return isSuperAdmin(user);
};

/**
 * Checks if the user is an admin of their specific agency
 */
export const isAgencyAdmin = (user: ISafeUser | null): boolean => {
  return user?.role === UserRole.ADMIN;
};
