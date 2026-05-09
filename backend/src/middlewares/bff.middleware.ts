/**
 * BFF Middleware
 *
 * Responsibilities:
 *  - Extract & validate the session-ID cookie (bffAuthenticate)
 *  - Step-up 2FA for sensitive operations (requireBFFStepUp)
 *  - Password-change gate (checkBFFPasswordChangeRequired)
 *  - Device fingerprinting helpers
 *  - Cookie set / clear helpers
 *  - Proxy token injection (proxyWithAuth)
 */

import type { NextFunction, Request, Response } from "express";
import { TwoFactorMethod } from "../prisma/prisma/generated/enums.js";
import { prisma } from "../lib/prisma.js";
import { BFFService } from "../services/bff.service.js";
import { TwoFactorService } from "../services/twoFactorAuth.service.js";
import type { IBFFRequestContext, IDeviceFingerprint } from "../types/bff.types.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";
import { asyncHandler } from "../utils/app.utils.js";
import { bffConfig, bffErrorCodes } from "../config/bff.config.js";

// ─────────────────────────────────────────────
// SESSION EXTRACTION
// ─────────────────────────────────────────────

/**
 * Extract the session ID from the HttpOnly cookie.
 * This is the ONLY credential the client ever transmits.
 */
export const extractSessionId = (req: Request): string | null => req.cookies?.[bffConfig.session.cookieName] ?? null;

// ─────────────────────────────────────────────
// BFF AUTHENTICATE
// ─────────────────────────────────────────────

/**
 * Core BFF authentication middleware.
 *
 * 1. Reads the session-ID cookie.
 * 2. Validates the Redis session (auto-refreshes the access token if needed).
 * 3. Loads the user from DB / cache and runs account-status checks.
 * 4. Attaches both `req.user` (backward-compat) and `req.bffContext`.
 */
export const bffAuthenticate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = extractSessionId(req);

  if (!sessionId) {
    throw AppError.unauthorized("Authentication required. No session found.", "BFFMiddleware", { code: bffErrorCodes.SESSION_NOT_FOUND });
  }

  const result = await BFFService.validateAndRefreshSession(sessionId);

  if (!result.valid || !result.session) {
    throw AppError.unauthorized(`Session invalid: ${result.errorMessage}`, "BFFMiddleware", { code: bffErrorCodes.SESSION_INVALID, reason: result.errorMessage });
  }

  const session = result.session;

  // Load full user (includes agency fields required downstream)
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      agency: {
        select: {
          id: true,
          name: true,
          type: true,
          jurisdictionLevel: true,
          status: true,
        },
      },
    },
  });

  if (!user) {
    throw AppError.unauthorized("User not found", "BFFMiddleware");
  }

  if (!user.emailVerified) {
    throw AppError.forbidden("Your account is not activated. Please check your email for the activation link.", "BFFMiddleware");
  }

  if (!user.isActive) {
    throw AppError.forbidden("Account is deactivated. Please contact your administrator.", "BFFMiddleware");
  }

  // Guard: user.agency is null when agencyId is unset on the record (data integrity issue)
  if (!user.agency) {
    throw AppError.forbidden("Your account is not associated with any agency. Please contact support.", "BFFMiddleware");
  }

  if (user.agency.status !== "ACTIVE") {
    throw AppError.forbidden("Your agency is currently inactive. Please contact support.", "BFFMiddleware");
  }

  // ── Attach to req for backward-compatibility with existing middleware ──
  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    agencyId: user.agencyId,
    firstName: user.firstName,
    lastName: user.lastName,
    isTwoFactorEnabled: user.isTwoFactorEnabled,
    twoFactorMethod: user.twoFactorMethod,
    twoFactorSecret: user.twoFactorSecret,
    twoFactorBackupCodes: user.twoFactorBackupCodes,
    agency: {
      id: user.agency.id,
      name: user.agency.name,
      type: user.agency.type,
      jurisdictionLevel: user.agency.jurisdictionLevel,
      status: user.agency.status,
    },
  };

  // ── Attach BFF context (includes session with tokens — never forwarded) ──
  const context: IBFFRequestContext = {
    sessionId,
    session,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      agencyId: user.agencyId,
    },
  };

  (req as any).bffContext = context;

  next();
});

// ─────────────────────────────────────────────
// STEP-UP 2FA  (replaces `requireTwoFactor`)
// ─────────────────────────────────────────────

/**
 * requireBFFStepUp — step-up 2FA middleware for sensitive BFF operations.
 *
 * Mirrors the behaviour of `requireTwoFactor` from `twoFactorAuth.middlewares.ts`
 * but is designed for the BFF session context (no JWT in headers).
 *
 * Usage:  router.post('/change-password', requireBFFStepUp, BFFController.changePassword)
 *
 * Protocol:
 *  - If user has no 2FA: passes straight through.
 *  - If user has 2FA but no code in `X-2FA-Code`: throws 428 Precondition Required.
 *  - If code is present: verifies and calls next().
 */
export const requireBFFStepUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = (req as any).bffContext as IBFFRequestContext;

    if (!context) {
      throw AppError.unauthorized("BFF context missing — run bffAuthenticate first", "BFFMiddleware");
    }

    const user = req.user!;

    // No 2FA configured → pass through
    if (!user.isTwoFactorEnabled) {
      return next();
    }

    const code = req.headers["x-2fa-code"] as string | undefined;

    if (!code) {
      throw AppError.precondition(`Two-factor authentication required. Method: ${user.twoFactorMethod}`, "BFFMiddleware", { requiresTwoFactor: true, method: user.twoFactorMethod });
    }

    // Verify the code
    let isValid = false;
    const isBackupCode = code.length === 8;

    if (isBackupCode) {
      isValid = await TwoFactorService.verifyBackupCode(user.id, code, user.twoFactorBackupCodes ?? []);
    } else {
      switch (user.twoFactorMethod) {
        case TwoFactorMethod.GOOGLE_AUTHENTICATOR:
          if (!user.twoFactorSecret) {
            throw AppError.internal("2FA configuration error", null, "BFFMiddleware");
          }
          isValid = await TwoFactorService.verifyTOTP(user.id, code, user.twoFactorSecret);
          break;

        case TwoFactorMethod.EMAIL:
          isValid = await TwoFactorService.verifyEmailOTP(user.id, code);
          break;

        default:
          throw AppError.internal("Unknown 2FA method", null, "BFFMiddleware");
      }
    }

    if (!isValid) {
      throw AppError.unauthorized("Invalid or expired verification code", "BFFMiddleware");
    }

    next();
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// PASSWORD CHANGE GATE
// ─────────────────────────────────────────────

/**
 * Blocks all routes except the password-change and logout endpoints
 * when the session's `requiresPasswordChange` flag is true.
 */
export const checkBFFPasswordChangeRequired = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const context = (req as any).bffContext as IBFFRequestContext;

  if (!context?.session.requiresPasswordChange) {
    return next();
  }

  const allowedPaths = ["/auth/change-password", "/auth/logout", "/session/status"];

  const isAllowed = allowedPaths.some((p) => req.path.endsWith(p));
  if (!isAllowed) {
    throw AppError.forbidden("Password change required. Please change your password before continuing.", "BFFMiddleware", { requiresPasswordChange: true });
  }

  next();
});

// ─────────────────────────────────────────────
// DEVICE FINGERPRINTING
// ─────────────────────────────────────────────

/**
 * Builds an IDeviceFingerprint from request headers and generates its hash.
 */
export const extractDeviceFingerprint = (req: Request): IDeviceFingerprint => {
  const userAgent = req.headers["user-agent"] ?? "";
  const acceptLanguage = req.headers["accept-language"] ?? "";

  const fp: IDeviceFingerprint = {
    userAgent,
    language: acceptLanguage.split(",")[0] as string,
    // platform: undefined,
    // timezone: undefined,
    // screenResolution: undefined,
    // colorDepth: undefined,
  };

  fp.hash = BFFService.generateDeviceFingerprintHash(fp);
  return fp;
};

/**
 * Optional security middleware: rejects requests where the device
 * fingerprint has changed since the session was created.
 * Enable via BFF_CONFIG.SECURITY.ENABLE_DEVICE_FINGERPRINTING.
 */
export const validateDeviceFingerprint = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!bffConfig.security.enableDeviceFingerprinting) {
    return next();
  }

  const context = (req as any).bffContext as IBFFRequestContext;
  const current = extractDeviceFingerprint(req);

  if (context.session.deviceFingerprint && current.hash) {
    if (context.session.deviceFingerprint !== current.hash) {
      logger.warn("BFF: Device fingerprint mismatch", {
        userId: context.user.id,
        sessionId: context.sessionId,
      });

      const { createAuditLog } = await import("../utils/auditLog.util.js");
      const { ActionType, EntityType } = await import("../prisma/prisma/generated/enums.js");

      await createAuditLog(
        context.user.id,
        ActionType.SECURITY_ALERT,
        EntityType.USER,
        context.user.id,
        {
          description: "Device fingerprint mismatch detected",
          sessionId: context.sessionId,
        },
        req.ip,
        req.headers["user-agent"],
      );

      // Uncomment to hard-reject instead of just logging:
      // throw AppError.forbidden('Device validation failed', 'BFFMiddleware');
    }
  }

  next();
});

// ─────────────────────────────────────────────
// COOKIE HELPERS
// ─────────────────────────────────────────────

/** Set the session-ID cookie. Only credential ever sent to the browser. */
export const setSessionCookie = (res: Response, sessionId: string): void => {
  res.cookie(bffConfig.session.cookieName, sessionId, {
    httpOnly: bffConfig.cookie.httpOnly,
    secure: bffConfig.cookie.secure,
    sameSite: bffConfig.cookie.sameSite as "lax" | "strict" | "none",
    path: bffConfig.cookie.path,
    domain: bffConfig.cookie.domain,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

/** Clear the session-ID cookie. */
export const clearSessionCookie = (res: Response): void => {
  res.clearCookie(bffConfig.session.cookieName, {
    httpOnly: bffConfig.cookie.httpOnly,
    secure: bffConfig.cookie.secure,
    sameSite: bffConfig.cookie.sameSite as "lax" | "strict" | "none",
    path: bffConfig.cookie.path,
    domain: bffConfig.cookie.domain,
  });
};

// ─────────────────────────────────────────────
// PROXY HELPERS
// ─────────────────────────────────────────────

/**
 * Returns the access token from the BFF session context.
 * Used internally by the BFF to attach a Bearer token before
 * forwarding requests to upstream micro-services.
 */
export const getAccessTokenForProxy = (req: Request): string => {
  const context = (req as any).bffContext as IBFFRequestContext;

  if (!context?.session) {
    throw AppError.unauthorized("No session context", "BFFMiddleware");
  }

  return context.session.accessToken;
};

/**
 * Injects the Bearer token into the outgoing request so the upstream
 * service can use the existing `authenticate` middleware unmodified.
 */
export const proxyWithAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  req.headers.authorization = `Bearer ${getAccessTokenForProxy(req)}`;
  next();
});