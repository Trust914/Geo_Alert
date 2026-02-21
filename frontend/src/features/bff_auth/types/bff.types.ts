/**
 * BFF Feature Types
 * Complete type definitions for Backend-for-Frontend pattern
 */

import type { TwoFactorMethod, UserRole } from "../../../types/enums.types";
import type { IAgency } from "../../agencies/types";

// ============================================================================
// SESSION TYPES
// ============================================================================

export interface BFFSession {
  id: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date | string;
  lastActivityAt: Date | string;
  expiresAt: Date | string;
  isRevoked: boolean;
  isCurrent?: boolean;
}

export interface SessionStatus {
  user: BFFUser;
  session: {
    id: string;
    createdAt: Date | string;
    expiresAt: Date | string;
    lastActivityAt: Date | string;
    remainingIdleTime: number;
  };
  tokens: {
    accessTokenExpiresAt: Date | string;
    refreshTokenExpiresAt: Date | string;
  };
  mustChangePassword: boolean;
}

// ============================================================================
// USER TYPES
// ============================================================================

export interface BFFUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  agencyId: string;
  isTwoFactorEnabled: boolean;
  twoFactorMethod?: TwoFactorMethod;
  mustChangePassword?: boolean;
  emailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date | string;
  agency?: IAgency;
}

// Response wrapper for /me endpoint - backend returns { user: {...} }
export interface GetCurrentUserResponse {
  user: BFFUser;
}

// ============================================================================
// AUTHENTICATION REQUEST/RESPONSE TYPES
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user?: BFFUser;
  requiresTwoFactor: boolean;
  twoFactorMethod?: TwoFactorMethod;
  preAuthToken?: string;
  accessToken?: string;
}

export interface TwoFactorVerifyRequest {
  code: string;
}

export interface TwoFactorVerifyResponse {
  user: BFFUser;
  accessToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  accessTokenExpiresAt: Date | string;
  refreshTokenRotated?: boolean;
}

// ============================================================================
// PASSWORD MANAGEMENT TYPES
// ============================================================================

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface VerifyResetTokenRequest {
  userId: string;
  token: string;
}

export interface VerifyResetTokenResponse {
  valid: boolean;
  requiresTwoFactor: boolean;
  twoFactorMethod?: TwoFactorMethod;
}

export interface CompletePasswordResetRequest {
  userId: string;
  token: string;
  newPassword: string;
  totpCode?: string;
}

export interface ResendPasswordResetOTPRequest {
  userId: string;
  token: string;
}

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface BFFContextType {
  user: BFFUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionStatus: SessionStatus | null;
  setAuth: (user: BFFUser) => void;
  logout: () => Promise<void>;
  updateUser: (user: BFFUser) => void;
  refreshSession: () => Promise<void>;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface BFFError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface TwoFactorError extends Error {
  is2FARequired?: boolean;
  method?: TwoFactorMethod;
  originalRequest?: unknown;
}