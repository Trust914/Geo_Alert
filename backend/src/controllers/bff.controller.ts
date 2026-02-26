import type { Request, Response } from "express";
import statusCodes from "http-status";
import { BFFService } from "../services/bff.service.js";
import type { IBFFAuditLogFilters, IBFFLoginRequest, IBFF2FAVerifyRequest, IBFFRequestContext } from "../types/bff.types.js";
import { is2FARequiredResponse } from "../types/bff.types.js";
import { asyncHandler } from "../utils/app.utils.js";
import { AppError } from "../utils/error.util.js";
import type { ActionType, EntityType } from "../prisma/prisma/generated/enums.js";
import { clearSessionCookie, extractDeviceFingerprint, extractSessionId, setSessionCookie } from "../middlewares/bff.middleware.js";

export class BFFController {
  // ═══════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/bff/auth/login
   *
   * On success:       sets session-ID cookie, returns user + session metadata.
   * On 2FA required:  sets temp-session cookie, returns 202 with method info.
   */
  static login = asyncHandler(async (req: Request, res: Response) => {
    const rawFp = extractDeviceFingerprint(req);

    const deviceInfo: IBFFLoginRequest["deviceInfo"] = {
      ...(rawFp.hash !== undefined && { fingerprint: rawFp.hash }),
      ...(req.body.platform !== undefined && { platform: String(req.body.platform) }),
      ...(req.headers["user-agent"] !== undefined && { userAgent: req.headers["user-agent"] }),
    };

    const loginRequest: IBFFLoginRequest = {
      email: req.body.email,
      password: req.body.password,
      deviceInfo,
    };

    const result = await BFFService.login(loginRequest, req.ip, req.headers["user-agent"]);

    if (is2FARequiredResponse(result)) {
      // Temp session cookie lets the verify-2fa and resend-otp endpoints
      // identify the pending authentication without a header token.
      setSessionCookie(res, result.data.tempSessionId);

      return res.status(statusCodes.ACCEPTED).json({
        success: true,
        message: "Two-factor authentication required",
        data: {
          requiresTwoFactor: true,
          twoFactorMethod: result.data.twoFactorMethod,
          expiresIn: result.data.expiresIn,
          user: result.data.user,
        },
      });
    }

    // Replace any temp cookie with the permanent session cookie
    setSessionCookie(res, result.data.sessionId);

    return res.status(statusCodes.OK).json({
      success: true,
      message: "Login successful",
      data: {
        user: result.data.user,
        session: {
          expiresAt: result.data.session.expiresAt,
          maxIdleTime: result.data.session.maxIdleTime,
        },
      },
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // VERIFY 2FA
  // ═══════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/bff/auth/verify-2fa
   *
   * Reads the temp-session cookie set during login.
   * On success: replaces it with the final session cookie.
   */
  static verify2FA = asyncHandler(async (req: Request, res: Response) => {
    const tempSessionId = extractSessionId(req);

    if (!tempSessionId) {
      throw AppError.badRequest("No temporary session found. Please login again.", "BFFController");
    }

    const { code } = req.body;
    if (!code?.trim()) {
      throw AppError.badRequest("Verification code is required", "BFFController");
    }

    const verifyRequest: IBFF2FAVerifyRequest = {
      code: code.trim(),
      tempSessionId,
    };

    const result = await BFFService.verify2FA(verifyRequest, req.ip, req.headers["user-agent"]);

    setSessionCookie(res, result.data.sessionId);

    return res.status(statusCodes.OK).json({
      success: true,
      message: "Two-factor authentication successful",
      data: {
        user: result.data.user,
        session: {
          expiresAt: result.data.session.expiresAt,
          maxIdleTime: result.data.session.maxIdleTime,
        },
      },
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RESEND OTP  (login flow)
  // ═══════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/bff/auth/resend-otp
   *
   * Uses the temp-session cookie set during login.
   * Only valid for Email 2FA users — Authenticator app users don't need it.
   */
  static resendLoginOTP = asyncHandler(async (req: Request, res: Response) => {
    const tempSessionId = extractSessionId(req);

    if (!tempSessionId) {
      throw AppError.badRequest("No temporary session found. Please login again.", "BFFController");
    }

    await BFFService.resendLoginOTP(tempSessionId, req.ip, req.headers["user-agent"]);

    return res.status(statusCodes.OK).json({
      success: true,
      message: "Verification code resent successfully",
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TOKEN REFRESH (Manual — Optional)
  // ═══════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/bff/auth/refresh
   *
   * Manually refresh access token (and rotate refresh token if near expiry).
   * Note: The BFF middleware automatically handles token refresh, so this
   * endpoint is optional. Use it if you want client-controlled refresh timing.
   *
   * This is protected by bffAuthenticate middleware.
   */
  static refreshTokens = asyncHandler(async (req: Request, res: Response) => {
    const context = (req as any).bffContext as IBFFRequestContext;

    const result = await BFFService.manualRefreshTokens(context.sessionId, req.ip, req.headers["user-agent"]);

    return res.status(statusCodes.OK).json({
      success: true,
      message: result.message,
      data: {
        accessTokenExpiresAt: result.data.accessTokenExpiresAt,
        refreshTokenRotated: result.data.refreshTokenRotated,
      },
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════════════════════════

  /** POST /api/v1/bff/auth/logout */
  static logout = asyncHandler(async (req: Request, res: Response) => {
    const context = (req as any).bffContext as IBFFRequestContext;

    await BFFService.logout(context.sessionId, req.ip, req.headers["user-agent"]);
    clearSessionCookie(res);

    return res.status(statusCodes.OK).json({
      success: true,
      message: "Logout successful",
    });
  });

  /**
   * POST /api/v1/bff/auth/logout-all
   * Protected by requireBFFStepUp.
   */
  static logoutAll = asyncHandler(async (req: Request, res: Response) => {
    const context = (req as any).bffContext as IBFFRequestContext;

    await BFFService.logoutAll(context.user.id, context.sessionId, req.ip, req.headers["user-agent"]);

    clearSessionCookie(res);

    return res.status(statusCodes.OK).json({
      success: true,
      message: "Logged out from all devices successfully",
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CURRENT USER
  // ═══════════════════════════════════════════════════════════════

  /** GET /api/v1/bff/auth/me */
  static getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    const context = (req as any).bffContext as IBFFRequestContext;

    const user = await BFFService.getCurrentUser(context.user.id);

    return res.status(statusCodes.OK).json({
      success: true,
      message: "User retrieved",
      data: { user },
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CHANGE PASSWORD
  // ═══════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/bff/auth/change-password
   * Protected by requireBFFStepUp.
   * After success the session is gone — client must re-login.
   */
  static changePassword = asyncHandler(async (req: Request, res: Response) => {
    const context = (req as any).bffContext as IBFFRequestContext;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw AppError.badRequest("currentPassword and newPassword are required", "BFFController");
    }

    await BFFService.changePassword(context.sessionId, context.user.id, currentPassword, newPassword, req.ip, req.headers["user-agent"]);

    // All sessions were destroyed server-side — clear the cookie too
    clearSessionCookie(res);

    return res.status(statusCodes.OK).json({
      success: true,
      message: "Password changed successfully. Please login with your new password.",
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SESSION STATUS & LIST
  // ═══════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/bff/session/status
   *
   * Returns detailed session information including:
   * - Token expiry times (access & refresh)
   * - Remaining idle time
   * - Session lifecycle metadata
   */
  static getSessionStatus = asyncHandler(async (req: Request, res: Response) => {
    const context = (req as any).bffContext as IBFFRequestContext;

    const result = await BFFService.getSessionStatus(context.sessionId);

    return res.status(statusCodes.OK).json(result);
  });

  /** GET /api/v1/bff/sessions */
  static getSessions = asyncHandler(async (req: Request, res: Response) => {
    const context = (req as any).bffContext as IBFFRequestContext;

    const result = await BFFService.getUserSessions(context.user.id, context.sessionId);

    return res.status(statusCodes.OK).json(result);
  });

  /**
   * DELETE /api/v1/bff/sessions/:sessionId
   * Protected by requireBFFStepUp.
   */
  static revokeSession = asyncHandler(async (req: Request, res: Response) => {
    const context = (req as any).bffContext as IBFFRequestContext;
    const { sessionId } = req.params;

    if (!sessionId) {
      throw AppError.badRequest("Session ID is required", "BFFController");
    }

    await BFFService.revokeOneSession(context.user.id, sessionId, req.ip, req.headers["user-agent"]);

    // If revoking the caller's own current session, clear their cookie too
    if (sessionId === context.sessionId) {
      clearSessionCookie(res);
    }

    return res.status(statusCodes.OK).json({
      success: true,
      message: "Session revoked successfully",
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════

  /** GET /api/v1/bff/audit-logs */
  static getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const context = (req as any).bffContext as IBFFRequestContext;

    if (!req.pagination) {
      throw AppError.internal("Pagination middleware not applied", null, "BFFController");
    }

    const filters: IBFFAuditLogFilters = {
      action: req.query.action as ActionType,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : null,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : null,
      pagination: req.pagination,
      sortOptions: req.sort!,
    };

    const result = await BFFService.getUserAuditLogs(context.user.id, filters);

    return res.status(statusCodes.OK).json({
      success: true,
      message: "Audit logs retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  });

  /** GET /api/v1/bff/audit-logs/agency */
  static getAgencyAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const context = (req as any).bffContext as IBFFRequestContext;

    if (!req.pagination) {
      throw AppError.internal("Pagination middleware not applied", null, "BFFController");
    }

    const filters: IBFFAuditLogFilters = {
      action: req.query.action as ActionType,
      entityType: req.query.entityType as EntityType,
      userId: req.query.userId as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : null,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : null,
      pagination: req.pagination,
      sortOptions: req.sort!,
    };

    const result = await BFFService.getAgencyAuditLogs(context.user.agencyId, filters);

    return res.status(statusCodes.OK).json({
      success: true,
      message: "Agency audit logs retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PASSWORD RESET  (public — no BFF session required)
  // ═══════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/bff/reset-password/verify
   * Query params: userId, token
   */
  static verifyResetToken = asyncHandler(async (req: Request, res: Response) => {
    const { userId, token } = req.query;

    if (!userId || !token) {
      throw AppError.badRequest("Missing parameters: userId, token", "BFFController");
    }

    const result = await BFFService.verifyResetToken(userId as string, token as string);

    return res.status(statusCodes.OK).json({
      success: true,
      message: "Token valid",
      data: result,
    });
  });

  /**
   * POST /api/v1/bff/reset-password/complete
   * Body: { userId, token, newPassword, totpCode? }
   */
  static completePasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const { userId, token, newPassword, totpCode } = req.body;

    if (!userId || !token || !newPassword) {
      throw AppError.badRequest("Missing parameters: userId, token, newPassword", "BFFController");
    }

    await BFFService.completePasswordReset(userId, token, newPassword, totpCode);

    return res.status(statusCodes.OK).json({
      success: true,
      message: "Password reset successfully. You can now login.",
    });
  });

  /**
   * POST /api/v1/bff/reset-password/resend-otp
   * Body: { userId, token }  — stateless; reset token proves identity
   */
  static resendPasswordResetOTP = asyncHandler(async (req: Request, res: Response) => {
    const { userId, token } = req.body;

    if (!userId || !token) {
      throw AppError.badRequest("Missing parameters: userId, token", "BFFController");
    }

    await BFFService.resendPasswordResetOTP(userId, token, req.ip, req.headers["user-agent"]);

    return res.status(statusCodes.OK).json({
      success: true,
      message: "Verification code resent successfully",
    });
  });
}
