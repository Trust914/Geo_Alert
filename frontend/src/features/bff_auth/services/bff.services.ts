/**
 * BFF Service
 * API service layer for Backend-for-Frontend authentication and session management
 */

import { bffAxiosInstance } from "../../../lib/axios";
import type { APIResponse } from "../../../types/common.types";
import { API_ENDPOINTS } from "../../../utils/constants";
import type {
  LoginRequest,
  LoginResponse,
  TwoFactorVerifyRequest,
  TwoFactorVerifyResponse,
  RefreshTokenResponse,
  ChangePasswordRequest,
  VerifyResetTokenRequest,
  VerifyResetTokenResponse,
  CompletePasswordResetRequest,
  ResendPasswordResetOTPRequest,
  BFFSession,
  SessionStatus,
  BFFUser,
  GetCurrentUserResponse,
  AuditLogFilters,
  AuditLogsResponse,
} from "../types";

export const bffService = {
  // ============================================================================
  // AUTHENTICATION ENDPOINTS
  // ============================================================================

  /**
   * POST /api/v1/bff/auth/login
   * Initial authentication step
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { data } = await bffAxiosInstance.post<APIResponse<LoginResponse>>(API_ENDPOINTS.BFF_ENDPOINTS.LOGIN, credentials);
    return data.data!;
  },

  /**
   * POST /api/v1/bff/auth/verify-2fa
   * Complete 2FA verification during login
   */
  async verify2FA(request: TwoFactorVerifyRequest): Promise<TwoFactorVerifyResponse> {
    const { data } = await bffAxiosInstance.post<APIResponse<TwoFactorVerifyResponse>>(API_ENDPOINTS.BFF_ENDPOINTS.VERIFY_2FA, request);
    return data.data!;
  },

  /**
   * POST /api/v1/bff/auth/resend-otp
   * Resend email OTP during login flow
   */
  async resendLoginOTP(): Promise<void> {
    await bffAxiosInstance.post(API_ENDPOINTS.BFF_ENDPOINTS.RESEND_OTP);
  },

  /**
   * GET /api/v1/bff/auth/me
   * Get current user profile
   *
   * Note: Backend returns { user: {...} } wrapper, we extract the user object
   */
  async getCurrentUser(): Promise<BFFUser> {
    const { data } = await bffAxiosInstance.get<APIResponse<GetCurrentUserResponse>>(
      API_ENDPOINTS.BFF_ENDPOINTS.ME
    );
    return data.data!.user;
  },

  /**
   * POST /api/v1/bff/auth/refresh
   * Manually refresh access token (optional - middleware auto-refreshes)
   */
  async refreshTokens(): Promise<RefreshTokenResponse> {
    const { data } = await bffAxiosInstance.post<APIResponse<RefreshTokenResponse>>(API_ENDPOINTS.BFF_ENDPOINTS.REFRESH);
    return data.data!;
  },

  /**
   * POST /api/v1/bff/auth/logout
   * Logout from current session
   */
  async logout(): Promise<void> {
    await bffAxiosInstance.post(API_ENDPOINTS.BFF_ENDPOINTS.LOGOUT);
  },

  /**
   * POST /api/v1/bff/auth/logout-all
   * Logout from ALL devices/sessions (requires step-up 2FA)
   */
  async logoutAll(twoFactorCode: string): Promise<void> {
    await bffAxiosInstance.post(
      API_ENDPOINTS.BFF_ENDPOINTS.LOGOUT_ALL,
      {},
      {
        headers: {
          "X-2FA-Code": twoFactorCode,
        },
      },
    );
  },

  /**
   * POST /api/v1/bff/auth/change-password
   * Change user password (requires step-up 2FA)
   */
  async changePassword(request: ChangePasswordRequest, twoFactorCode: string): Promise<void> {
    await bffAxiosInstance.post(API_ENDPOINTS.BFF_ENDPOINTS.CHANGE_PASSWORD, request, {
      headers: {
        "X-2FA-Code": twoFactorCode,
      },
    });
  },

  // ============================================================================
  // PASSWORD RESET ENDPOINTS
  // ============================================================================

  /**
   * GET /api/v1/bff/reset-password/verify
   * Verify password reset token validity
   */
  async verifyResetToken(params: VerifyResetTokenRequest): Promise<VerifyResetTokenResponse> {
    const { data } = await bffAxiosInstance.get<APIResponse<VerifyResetTokenResponse>>(API_ENDPOINTS.BFF_ENDPOINTS.RESET_PASSWORD_VERIFY, { params });
    return data.data!;
  },

  /**
   * POST /api/v1/bff/reset-password/complete
   * Complete password reset process
   */
  async completePasswordReset(request: CompletePasswordResetRequest): Promise<void> {
    await bffAxiosInstance.post(API_ENDPOINTS.BFF_ENDPOINTS.RESET_PASSWORD_COMPLETE, request);
  },

  /**
   * POST /api/v1/bff/reset-password/resend-otp
   * Resend OTP during password reset flow
   */
  async resendPasswordResetOTP(request: ResendPasswordResetOTPRequest): Promise<void> {
    await bffAxiosInstance.post(API_ENDPOINTS.BFF_ENDPOINTS.RESET_PASSWORD_RESEND_OTP, request);
  },

  // ============================================================================
  // SESSION MANAGEMENT ENDPOINTS
  // ============================================================================

  /**
   * GET /api/v1/bff/session/status
   * Get detailed session status
   */
  async getSessionStatus(): Promise<SessionStatus> {
    const { data } = await bffAxiosInstance.get<APIResponse<SessionStatus>>(API_ENDPOINTS.BFF_ENDPOINTS.SESSION_STATUS);
    return data.data!;
  },

  /**
   * GET /api/v1/bff/sessions
   * List all active sessions for current user
   */
  async getSessions(): Promise<BFFSession[]> {
    const { data } = await bffAxiosInstance.get<APIResponse<BFFSession[]>>(API_ENDPOINTS.BFF_ENDPOINTS.SESSIONS);
    return data.data!;
  },

  /**
   * DELETE /api/v1/bff/sessions/:sessionId
   * Revoke a specific session (requires step-up 2FA)
   */
  async revokeSession(sessionId: string, twoFactorCode: string): Promise<void> {
    await bffAxiosInstance.delete(API_ENDPOINTS.BFF_ENDPOINTS.REVOKE_SESSION(sessionId), {
      headers: {
        "X-2FA-Code": twoFactorCode,
      },
    });
  },

  // ============================================================================
  // AUDIT LOG ENDPOINTS
  // ============================================================================

  /**
   * GET /api/v1/bff/audit-logs
   * Get audit logs for current user
   */
  async getAuditLogs(filters?: AuditLogFilters): Promise<AuditLogsResponse> {
    const { data } = await bffAxiosInstance.get<APIResponse<AuditLogsResponse>>(API_ENDPOINTS.BFF_ENDPOINTS.AUDIT_LOGS, { params: filters });
    return data.data!;
  },

  /**
   * GET /api/v1/bff/audit-logs/agency
   * Get audit logs for current user's agency
   */
  async getAgencyAuditLogs(filters?: AuditLogFilters): Promise<AuditLogsResponse> {
    const { data } = await bffAxiosInstance.get<APIResponse<AuditLogsResponse>>(API_ENDPOINTS.BFF_ENDPOINTS.AGENCY_AUDIT_LOGS, { params: filters });
    return data.data!;
  },
};