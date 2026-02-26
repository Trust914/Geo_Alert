/**
 * BFF Type Definitions
 * Proper BFF pattern: Server-side token storage only.
 * Client receives ONLY a session-ID cookie — never tokens.
 */

import type { ActionType, EntityType, TwoFactorMethod, UserRole } from "../prisma/prisma/generated/enums.js";
import type { IPagination, ISortOptions } from "./common.types.js";

// ─────────────────────────────────────────────
// SESSION (stored server-side in Redis)
// ─────────────────────────────────────────────

export interface IBFFSession {
  sessionId: string;
  userId: string;
  agencyId: string;
  role: UserRole;

  // Tokens — NEVER sent to client
  accessToken: string;
  refreshToken: string;

  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  tokenFamily?: string;

  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;

  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;

  requiresPasswordChange: boolean;
  has2FAEnabled: boolean;
}

/** The only thing ever sent to the browser */
export interface IBFFSessionCookie {
  sessionId: string;
}

// ─────────────────────────────────────────────
// REQUEST CONTEXT (attached to Express req)
// ─────────────────────────────────────────────

export interface IBFFRequestContext {
  sessionId: string;
  session: IBFFSession;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    agencyId: string;
  };
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

export interface IBFFLoginRequest {
  email: string;
  password: string;
  deviceInfo?: {
    fingerprint?: string;
    platform?: string;
    userAgent?: string;
  };
}

/** Successful login — NO tokens */
export interface IBFFLoginResponse {
  success: true;
  data: {
    sessionId: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: UserRole;
      agencyId: string;
      mustChangePassword: boolean;
      isTwoFactorEnabled: boolean;
      twoFactorMethod?: TwoFactorMethod;
    };
    session: {
      expiresAt: Date;
      maxIdleTime: number; // ms
    };
  };
}

/** Login blocked until 2FA is satisfied */
export interface IBFF2FARequiredResponse {
  success: true;
  data: {
    requiresTwoFactor: true;
    twoFactorMethod: TwoFactorMethod;
    tempSessionId: string;
    expiresIn: number; // seconds
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  };
}

// ─────────────────────────────────────────────
// 2FA — LOGIN COMPLETION
// ─────────────────────────────────────────────

export interface IBFF2FAVerifyRequest {
  code: string;
  tempSessionId: string;
}

// ─────────────────────────────────────────────
// RESEND OTP  (login flow — uses temp session)
// ─────────────────────────────────────────────

/** No body needed — temp session comes from cookie */
export interface IBFFResendOTPRequest {
  /** Populated server-side from the temp-session cookie */
  tempSessionId: string;
}

// ─────────────────────────────────────────────
// CURRENT USER
// ─────────────────────────────────────────────

export interface IBFFCurrentUserResponse {
  success: true;
  message: string;
  data: {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: UserRole;
      agencyId: string;
      isTwoFactorEnabled: boolean;
      twoFactorMethod?: TwoFactorMethod;
      mustChangePassword: boolean;
    };
  };
}

// ─────────────────────────────────────────────
// SESSION STATUS & LIST
// ─────────────────────────────────────────────

export interface IBFFSessionStatusResponse {
  success: true;
  data: {
    sessionId: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: UserRole;
      agencyId: string;
      mustChangePassword: boolean;
      isTwoFactorEnabled: boolean;
    };
    session: {
      createdAt: Date;
      expiresAt: Date;
      lastActivityAt: Date;
      remainingIdleTime: number; // seconds
      accessTokenExpiresAt: Date;
      accessTokenExpiresIn: number; // seconds
      refreshTokenExpiresAt: Date;
      refreshTokenExpiresIn: number; // seconds
      maxIdleTime: number; // seconds
    };
    requiresPasswordChange: boolean;
  };
}

export interface IBFFSessionsListResponse {
  success: true;
  message: string;
  data: {
    sessions: Array<{
      sessionId: string;
      createdAt: Date;
      lastActivityAt: Date;
      expiresAt: Date;
      ipAddress?: string;
      userAgent?: string;
      isCurrent: boolean;
    }>;
  };
}

// ─────────────────────────────────────────────
// CHANGE PASSWORD (step-up 2FA required)
// ─────────────────────────────────────────────

export interface IBFFChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  /**
   * 2FA code supplied via the X-2FA-Code request header.
   * Validated by requireBFFStepUp middleware before the
   * controller is reached — not read directly by the service.
   */
}

// ─────────────────────────────────────────────
// PASSWORD RESET  (public — no session required)
// ─────────────────────────────────────────────

export interface IBFFVerifyResetTokenRequest {
  userId: string;
  token: string;
}

export interface IBFFVerifyResetTokenResponse {
  success: true;
  message: string;
  data: {
    valid: boolean;
    requiresTwoFactor: boolean;
    twoFactorMethod?: TwoFactorMethod | string;
  };
}

export interface IBFFCompletePasswordResetRequest {
  userId: string;
  token: string;
  newPassword: string;
  totpCode?: string;
}

// ─────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────

export interface IBFFAuditLogFilters {
  action?: ActionType;
  entityType?: EntityType;
  userId?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  pagination: IPagination;
  sortOptions: ISortOptions;
}

export interface IBFFAuditLogEntry {
  id: string;
  action: ActionType;
  entityType: EntityType;
  entityId: string;
  description?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp: Date;
  userId: string | null;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
  };
}

export interface IBFFAuditLogResponse {
  success: true;
  message: string;
  data: IBFFAuditLogEntry[];
  pagination: {
    total: number;
    currentPage: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

export interface IBFFTemp2FASession {
  tempSessionId: string;
  userId: string;
  email: string;
  twoFactorMethod: TwoFactorMethod;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

export interface ISessionValidationResult {
  valid: boolean;
  session?: IBFFSession;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    agencyId: string;
    mustChangePassword: boolean;
    isTwoFactorEnabled: boolean;
  };
  errorCode?: string;
  errorMessage?: string;
  tokensRefreshed?: boolean;
  refreshTokenRotated?: boolean;
}

export interface ITokenRefreshResult {
  success: boolean;
  message: string;
  data: {
    accessTokenExpiresAt: Date;
    refreshTokenRotated: boolean;
  };
}

export interface IBFFProxyRequest {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface IDeviceFingerprint {
  userAgent: string;
  platform?: string;
  language?: string;
  timezone?: string;
  screenResolution?: string;
  colorDepth?: number;
  hash?: string;
}

export interface IBFFErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: Date;
  };
}

// ─────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────

export function isBFFSession(obj: unknown): obj is IBFFSession {
  return typeof obj === "object" && obj !== null && typeof (obj as IBFFSession).sessionId === "string" && typeof (obj as IBFFSession).userId === "string" && typeof (obj as IBFFSession).accessToken === "string" && typeof (obj as IBFFSession).refreshToken === "string";
}

export function isBFFLoginResponse(obj: unknown): obj is IBFFLoginResponse {
  return typeof obj === "object" && obj !== null && (obj as IBFFLoginResponse).success === true && !!(obj as IBFFLoginResponse).data?.user && !!(obj as IBFFLoginResponse).data?.session;
}

export function is2FARequiredResponse(obj: unknown): obj is IBFF2FARequiredResponse {
  return typeof obj === "object" && obj !== null && (obj as IBFF2FARequiredResponse).success === true && (obj as IBFF2FARequiredResponse).data?.requiresTwoFactor === true;
}
