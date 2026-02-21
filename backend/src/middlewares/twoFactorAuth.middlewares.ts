import type { NextFunction, Request, Response } from "express";
import statusCodes from "http-status";
import { TwoFactorMethod } from "../prisma/prisma/generated/enums.js";
import { JWTService } from "../services/jwt.service.js";
import { TwoFactorService } from "../services/twoFactorAuth.service.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";

/**
 * 2FA Middleware (Step-Up Authentication)
 * * Flow:
 * 1. Checks if user has 2FA enabled.
 * 2. If enabled, checks for OTP in 'X-2FA-Code' header or body.
 * 3. If missing -> Throws 428 (Precondition Required).
 * 4. If present -> Verifies code -> Calls next().
 */
export const requireTwoFactor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "TwoFactorMiddleware");
    }

    // 1. Pass through if 2FA is not enabled
    if (!req.user.isTwoFactorEnabled) {
      return next();
    }

    // 2. Extract Token (Prefer Header for cleaner API design)
    const token = req.headers["x-2fa-code"] as string;

    logger.debug("2FA Token extracted:", { token });

    // 3. Handle Missing Token (Throw 428)
    if (!token) {
      throw AppError.precondition(`Two-factor authentication required. Method: ${req.user.twoFactorMethod}`, "TwoFactorMiddleware", {
        requiresTwoFactor: true,
        method: req.user.twoFactorMethod,
      });
    }

    // 4. Verify Token
    let isValid = false;
    const userId = req.user.id;

    // Detect if it's a Backup Code (8 chars) vs OTP (6 digits)
    const isBackupCodeCandidate = token.length === 8;

    if (isBackupCodeCandidate) {
      isValid = await TwoFactorService.verifyBackupCode(userId, token, req.user.twoFactorBackupCodes || []);
    } else {
      // Standard OTP Verification
      switch (req.user.twoFactorMethod) {
        case TwoFactorMethod.GOOGLE_AUTHENTICATOR:
          if (!req.user.twoFactorSecret) {
            throw AppError.internal("2FA configuration error", null, "TwoFactorMiddleware");
          }
          isValid = await TwoFactorService.verifyTOTP(userId, token, req.user.twoFactorSecret);
          break;

        case TwoFactorMethod.EMAIL:
          isValid = await TwoFactorService.verifyEmailOTP(userId, token);
          break;

        default:
          throw AppError.internal("Unknown 2FA method", null, "TwoFactorMiddleware");
      }
    }

    if (!isValid) {
      throw AppError.unauthorized("Invalid or expired verification code", "TwoFactorMiddleware");
    }

    // 5. Cleanup body (optional)
    // if (req.body.twoFactorToken) delete req.body.twoFactorToken;

    next();
  } catch (error) {
    next(error);
  }
};
