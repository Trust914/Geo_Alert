/**
 * ========================================
 * GEOALERT - User Type Definitions
 * ========================================
 * User-related interfaes and types for the frontend
 */

import type { LucideIcon } from "lucide-react";
import type { UserRole, AgencyType, AgencyStatus, JurisdictionLevel, TwoFactorMethod } from "../../../types/enums.types";
import type { IPaginationMeta } from "../../../types/common.types";

// ============================================
// AGENCY TYPES
// ============================================

/**
 * Agency information embedded in user object
 */
export interface IUserAgency {
  id: string;
  name: string;
  type: AgencyType;
  jurisdictionLevel: JurisdictionLevel;
  status: AgencyStatus;
  contactEmail: string;
}

// ============================================
// USER TYPES
// ============================================

/**
 * Complete user object (with sensitive data)
 */
export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  agencyId: string;
  mustChangePassword: boolean;
  emailVerified: boolean;
  isTwoFactorEnabled: boolean;
  twoFactorMethod: TwoFactorMethod | null;
  lastLoginAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  agency?: IUserAgency;
}

/**
 * Safe user object (without sensitive data)
 */
export interface ISafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  agencyId: string;
  mustChangePassword: boolean;
  emailVerified: boolean;
  isTwoFactorEnabled: boolean;
  twoFactorMethod: TwoFactorMethod | null;
  lastLoginAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  agency?: IUserAgency;
  requiresActivation?: boolean;
}

// ============================================
// DTO (Data Transfer Objects)
// ============================================

/**
 * Create user DTO
 */
export interface ICreateUserDTO {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  agencyId?: string;
}

/**
 * Update user DTO
 */
export interface IUpdateUserDTO {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isActive?: boolean;
}

/**
 * User filters for listing/searching
 */
export interface IUserFilters {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  currentPage?: number;
  limit?: number;
}

// ============================================
// FORM TYPES
// ============================================

/**
 * Create user form data
 */
export interface ICreateUserForm {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  agencyId?: string;
}

/**
 * Update user form data
 */
export interface IUpdateUserForm {
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * User list response with pagination
 */
export interface IUserListResponse {
  data: IUser[];
  pagination: IPaginationMeta;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

/**
 * User card component props
 */
export interface IUserCardProps {
  user: IUser;
  onEdit: (user: IUser) => void;
  onDeactivate: (userId: string) => void;
  onReactivate: (userId: string) => void;
  onResetPassword: (userId: string) => void;
  onView: (userId: string) => void;
}

/**
 * User table component props
 */
export interface IUserTableProps {
  users: IUser[];
  isLoading: boolean;
  onEdit: (user: IUser) => void;
  onDeactivate: (userId: string) => void;
  onReactivate: (userId: string) => void;
  onResetPassword: (userId: string) => void;
  onView: (userId: string) => void;
}

/**
 * User filter component props
 */
export interface IUserFilterProps {
  filters: IUserFilters;
  onFilterChange: (filters: IUserFilters) => void;
  onReset: () => void;
}
export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Create user modal props
 */
export interface ICreateUserModalProps extends BaseModalProps {
  onSuccess: () => void;
  agencyId?: string;
}

/**
 * Update user modal props
 */
export interface IUpdateUserModalProps extends BaseModalProps {
  user: IUser | null;
  onSuccess: () => void;
}

/**
 * User details modal props
 */
export interface IUserDetailsModalProps extends BaseModalProps {
  userId: string | null;
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Role option for select/radio inputs
 */
export interface IRoleOption {
  value: UserRole;
  label: string;
  description: string;
  icon?: LucideIcon;
}

/**
 * User status badge
 */
export interface IUserStatusBadge {
  color: string;
  text: string;
  icon: string;
}

/**
 * User action permissions
 */
export interface IUserPermissions {
  canEdit: boolean;
  canDeactivate: boolean;
  canDelete: boolean;
  canResetPassword: boolean;
  canViewDetails: boolean;
}
