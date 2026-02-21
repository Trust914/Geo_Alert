import type { Request, Response } from "express";
import statusCodes from "http-status";
import { TwoFactorService } from "../services/twoFactorAuth.service.js";
import type { T2FAGenericResponse, T2FAStatusResponse, TBackupCodesResponse, TEmailSetupResponse, TTOTPSetupResponse } from "../types/twoFactorAuth.types.js";
import { asyncHandler } from "../utils/app.utils.js";
import { AppError } from "../utils/error.util.js";
import { TwoFactorMethod } from "../prisma/prisma/generated/enums.js";
import { EmailPurpose } from "../types/email.types.js";
import { verifyUserPassword } from "../helpers/service.helpers.js";

export class TwoFactorController {
  /**
   * Setup TOTP (Google Authenticator)
   */
  static setupTOTP = asyncHandler(async (req: Request, res: Response<TTOTPSetupResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "TwoFactorController");
    }

    const result = await TwoFactorService.generateTOTPSetup(req.user.id, req.user.email);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Scan QR code with Google Authenticator app",
      data: result,
    });
  });

  /**
   * Verify and enable TOTP
   */
  static verifyTOTP = asyncHandler(async (req: Request, res: Response<T2FAGenericResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "TwoFactorController");
    }

    const { token } = req.body;

    await TwoFactorService.verifyAndEnableTOTP(req.user.id, token);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Two-factor authentication enabled successfully",
    });
  });

  /**
   * STEP 1: Initiate Email 2FA Setup
   * Sends verification email
   */
  static initiateEmail2FASetup = asyncHandler(async (req: Request, res: Response<TEmailSetupResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "TwoFactorController");
    }

    await TwoFactorService.initiateEmailSetup(req.user.id, req.user.email);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Verification code sent to your email",
      data: {
        email: req.user.email,
        expiresInSeconds: 300, // seconds
      },
    });
  });

  /**
   * STEP 2: Verify Email and Enable 2FA
   * Confirms email ownership
   */
  static verifyAndEnableEmail2FA = asyncHandler(async (req: Request, res: Response<TBackupCodesResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "TwoFactorController");
    }

    const { code } = req.body;

    if (!code?.trim()) {
      throw AppError.badRequest("Verification code is required", "TwoFactorController");
    }

    const result = await TwoFactorService.verifyAndEnableEmail2FA(req.user.id, code.trim());

    res.status(statusCodes.OK).json({
      success: true,
      message: "Email-based 2FA enabled successfully",
      data: {
        backupCodes: result.backupCodes,
      },
    });
  });

  static verifyPassword = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized("Auth required", "TwoFactorController");

    const { password } = req.body;
    if (!password) throw AppError.badRequest("Password is required", "TwoFactorController");

    await verifyUserPassword(req.user.id, password);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Password verified",
    });
  });

  /**
   * Disable 2FA (requires password confirmation)
   */
  static disable2FA = asyncHandler(async (req: Request, res: Response<T2FAGenericResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "TwoFactorController");
    }

    const { password } = req.body; // <--- Extract password

    // Pass password to the service for verification
    await TwoFactorService.disable2FA(req.user.id, password);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Two-factor authentication disabled successfully",
    });
  });

  /**
   * Regenerate backup codes
   */
  static regenerateBackupCodes = asyncHandler(async (req: Request, res: Response<TBackupCodesResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "TwoFactorController");
    }

    const backupCodes = await TwoFactorService.regenerateBackupCodes(req.user.id);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Backup codes regenerated successfully",
      data: backupCodes,
    });
  });

  /**
   * Get 2FA status
   */
  static get2FAStatus = asyncHandler(async (req: Request, res: Response<T2FAStatusResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "TwoFactorController");
    }

    res.status(statusCodes.OK).json({
      success: true,
      message: "2FA status retrieved",
      data: {
        enabled: req.user.isTwoFactorEnabled || false,
        method: req.user.twoFactorMethod,
        backupCodesCount: req.user.twoFactorBackupCodes?.length || 0,
      },
    });
  });

  /**
   * Request OTP for sensitive actions (Step-Up Auth)
   */
  static requestOtp = asyncHandler(async (req: Request, res: Response<T2FAGenericResponse>) => {
    if (!req.user) throw AppError.unauthorized("Auth required", "TwoFactorController");

    if (req.user.twoFactorMethod !== TwoFactorMethod.EMAIL) {
      throw AppError.badRequest("OTP not required for this method", "TwoFactorController");
    }

    await TwoFactorService.sendEmailOTP(req.user.id, req.user.email, EmailPurpose.ACTION);
    res.status(statusCodes.OK).json({
      success: true,
      message: "OTP sent to email",
    });
  });
}
