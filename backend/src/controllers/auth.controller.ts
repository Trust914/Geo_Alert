import type { Request, Response } from "express";
import statusCodes from "http-status";
import { mapToSafeUser } from "../helpers/service.helpers.js";
import type { ActionType, EntityType } from "../prisma/prisma/generated/enums.js";
import { AuthService } from "../services/auth.service.js";
import { JWTService } from "../services/jwt.service.js";
import type { IPaginatedApiResponse, IPaginationMeta } from "../types/api.response.js";
import type { AuthFilters, IAgencyAudiLogsResponse, TAuditLogResponse, TCurrentUserResponse, TGetSessionsResponse, TLoginResponse, TRefreshTokenResponse, TVerify2FAResponse } from "../types/auth.types.js";
import { asyncHandler } from "../utils/app.utils.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";
import { cacheConstants } from "../config/cache.constants.js";

export class AuthController {
  static login = asyncHandler(async (req: Request, res: Response<TLoginResponse>) => {
    const { email, password } = req.body;
    const result = await AuthService.login({ email, password }, req.ip, req.headers["user-agent"]);

    // If 2FA required, don't set refresh token cookie yet
    if (result.requiresTwoFactor) {
      logger.debug("Two-factor authentication required", {
        requiresTwoFactor: true,
        twoFactorMethod: result.twoFactorMethod!,
        preAuthToken: result.preAuthToken!,
        user: result.user,
      });
      return res.status(statusCodes.ACCEPTED).json({
        success: true,
        message: "Two-factor authentication required",
        data: {
          requiresTwoFactor: true,
          twoFactorMethod: result.twoFactorMethod!,
          preAuthToken: result.preAuthToken!,
          user: result.user,
        },
      });
    }

    // Complete login - set refresh token cookie
    JWTService.setCookie(res, result.refreshToken, "refreshToken", cacheConstants.ttl.WEEK);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Login successful",
      data: {
        user: result.user,
        accessToken: result.accessToken!,
      },
    });
  });

  static verifyTwoFactor = asyncHandler(async (req: Request, res: Response<TVerify2FAResponse>) => {
    const userId = req.user!.id; // Set by require2FA or extracted from preAuthToken middleware
    const { code } = req.body;
    logger.debug("preAuthToken verification", { preAuthToken: req.body.preAuthToken });

    if (!code?.trim()) {
      throw AppError.badRequest("Verification code is required", "AuthController");
    }

    const result = await AuthService.verifyTwoFactorLogin(userId, code.trim(), req.ip, req.headers["user-agent"]);

    JWTService.setCookie(res, result.refreshToken!, "refreshToken", cacheConstants.ttl.WEEK);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Two-factor authentication successful",
      data: {
        user: result.user,
        accessToken: result.accessToken!,
      },
    });
  });

  static refreshToken = asyncHandler(async (req: Request, res: Response<TRefreshTokenResponse>) => {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      throw AppError.unauthorized("Refresh token not provided", "AuthController");
    }

    const result = await AuthService.refreshAccessToken(refreshToken, req.ip, req.headers["user-agent"]);

    JWTService.clearCookie(res, "refreshToken");
    JWTService.setCookie(res, result.refreshToken, "refreshToken", cacheConstants.ttl.WEEK);

    logger.debug("Refresh access token successful", {
      userId: req.user?.id,
    });

    res.status(statusCodes.OK).json({
      success: true,
      message: "Token refreshed successfully",
      data: { accessToken: result.accessToken },
    });
  });

  static logout = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

    if (refreshToken || accessToken) {
      await AuthService.logout(refreshToken, accessToken, req.user?.id, req.ip, req.headers["user-agent"]);
    }

    JWTService.clearCookie(res, "refreshToken");

    res.status(statusCodes.OK).json({
      success: true,
      message: "Logout successful",
    });
  });

  static logoutAll = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "AuthController");
    }

    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

    await AuthService.logoutAll(req.user.id, accessToken, req.ip, req.headers["user-agent"]);

    JWTService.clearCookie(res, "refreshToken");

    res.status(statusCodes.OK).json({
      success: true,
      message: "Logged out from all devices successfully",
    });
  });

  static getCurrentUser = asyncHandler(async (req: Request, res: Response<TCurrentUserResponse>) => {
    // if (!req.user) {
    //   throw AppError.unauthorized("Authentication required", "AuthController");
    // }
    const safeUser = mapToSafeUser(req.user);

    res.status(statusCodes.OK).json({
      success: true,
      message: "User retrieved",
      data: { user: safeUser },
    });
  });

  static changePassword = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "AuthController");
    }

    const { currentPassword, newPassword } = req.body;

    await AuthService.changePassword(req.user.id, currentPassword, newPassword, req.ip, req.headers["user-agent"]);

    JWTService.clearCookie(res, "refreshToken");

    res.status(statusCodes.OK).json({
      success: true,
      message: "Password changed successfully. Please login with your new password.",
    });
  });

  static getSessions = asyncHandler(async (req: Request, res: Response<TGetSessionsResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "AuthController");
    }

    const sessions = await AuthService.getUserSessions(req.user.id);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Sessions retrieved",
      data: { sessions },
    });
  });

  static revokeSession = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "AuthController");
    }

    const sessionId = req.params.sessionId;

    await AuthService.revokeSession(req.user.id, sessionId!, req.ip, req.headers["user-agent"]);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Session revoked successfully",
    });
  });

  static getAuditLogs = asyncHandler(async (req: Request, res: Response<TAuditLogResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "AuthController");
    }

    if (!req.pagination) {
      throw AppError.internal("Pagination middleware not applied", null, "AuthController");
    }

    const filters: AuthFilters = {
      action: req.query.action as ActionType,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : null,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : null,
      pagination: req.pagination,
    };

    const result = await AuthService.getUserAuditLogs(req.user.id, filters);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Audit logs retrieved successfully",
      data: result.data as any, // Cast internal audit type to IAuditLogData
      pagination: result.pagination,
    });
  });

  static getAgencyAuditLogs = asyncHandler(async (req: Request, res: Response<IAgencyAudiLogsResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "AuthController");
    }

    if (!req.pagination) {
      throw AppError.internal("Pagination middleware not applied", null, "AuthController");
    }

    const filters: AuthFilters = {
      action: req.query.action as ActionType,
      entityType: req.query.entityType as EntityType,
      userId: req.query.userId as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : null,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : null,
      pagination: req.pagination,
    };

    const result = await AuthService.getAgencyAuditLogs(req.user.agencyId, filters);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Agency audit logs retrieved successfully",
      data: result.data as any,
      pagination: result.pagination,
    });
  });

  // Verify token (On page load)
  static verifyResetToken = asyncHandler(async (req: Request, res: Response) => {
    const { userId, token } = req.query;
    if (!userId || !token) throw AppError.badRequest("Missing parameters", "AuthController");

    const result = await AuthService.verifyResetToken(userId as string, token as string);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Token valid",
      data: result, // Returns { valid: true, requiresTwoFactor: true/false }
    });
  });

  // Complete reset (On form submit)
  static completePasswordReset = asyncHandler(async (req: Request, res: Response) => {
    // Extract totpCode (optional)
    const { userId, token, newPassword, totpCode } = req.body;

    if (!userId || !token || !newPassword) {
      throw AppError.badRequest("Missing parameters", "AuthController");
    }

    await AuthService.completePasswordReset(userId, token, newPassword, totpCode);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Password reset successfully. You can now login.",
    });
  });

  /**
   * Resend 2FA Code
   * Handles expired OTPs or undelivered emails
   */
  static resendTwoFactorCode = asyncHandler(async (req: Request, res: Response) => {
    // userId comes from requirePreAuth middleware decoding the token
    const userId = req.user!.id;

    // Extract the flag set by the middleware
    const isPasswordReset = res.locals.isPasswordReset === true;

    await AuthService.resendTwoFactorCode(userId, isPasswordReset, req.ip, req.headers["user-agent"]);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Verification code resent successfully",
    });
  });
}
