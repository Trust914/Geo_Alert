import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AgencyType, JurisdictionLevel, UserRole } from "../prisma/prisma/generated/enums.js";
import { AuthService } from "../services/auth.service.js";
import { getCacheService } from "../services/cache.service.js";
import { JWTService } from "../services/jwt.service.js";
import { asyncHandler, getNemaAgencyId } from "../utils/app.utils.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";
import { cacheConstants } from "../config/cache.constants.js";

export const authenticate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const cache = getCacheService();

  let token: string | undefined;
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    throw AppError.unauthorized("Authentication required. No token provided.", "AuthMiddleware");
  }

  // Check token blacklist
  const isBlacklisted = await cache.exists(cacheConstants.keys.AUTH.TOKEN_BLACKLIST, token);

  if (isBlacklisted) {
    throw AppError.unauthorized("Token has been revoked", "AuthMiddleware");
  }

  // Verify token
  const decoded = JWTService.verifyAccessToken(token);

  // Try cache first
  let user = await cache.get<any>(cacheConstants.keys.USER.BY_ID, decoded.userId);

  // Validate cached data has complete agency info
  const hasCompleteAgencyData = user?.agency && user.agency.id && user.agency.type && user.agency.jurisdictionLevel;

  if (!user || !hasCompleteAgencyData) {
    // Fetch fresh data if cache is empty or incomplete
    logger.debug("Fetching fresh user data - cache miss or incomplete agency data", {
      hasCachedUser: !!user,
      hasCompleteAgencyData,
    });

    user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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

    if (user) {
      // Update cache with complete data
      await cache.set(cacheConstants.keys.USER.BY_ID, decoded.userId, user, cacheConstants.ttl.USER_SESSION);
    }
  }

  logger.debug("user from db auth middleware", user);

  if (!user) {
    throw AppError.unauthorized("User not found", "AuthMiddleware");
  }
  if (!user.emailVerified) {
    throw AppError.forbidden("Your account is not activated. Please check your email for the activation link or request a new one.", "AuthMiddleware");
  }

  if (!user.isActive) {
    throw AppError.forbidden("Account is deactivated. Please contact your administrator.", "AuthMiddleware");
  }

  if (user.agency.status !== "ACTIVE") {
    throw AppError.forbidden("Your agency is currently inactive. Please contact support.", "AuthMiddleware");
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    agencyId: user.agencyId,
    firstName: user.firstName,
    lastName: user.lastName,
    isTwoFactorEnabled: user.isTwoFactorEnabled,
    twoFactorMethod: user.twoFactorMethod,
    twoFactorSecret: user.twoFactorSecret, // Needed by require2FA to verify TOTP
    twoFactorBackupCodes: user.twoFactorBackupCodes, // Needed by require2FA
    agency: {
      id: user.agency.id,
      name: user.agency.name,
      type: user.agency.type,
      jurisdictionLevel: user.agency.jurisdictionLevel,
      status: user.agency.status,
    },
  };

  logger.debug("user agency", req.user.agency);

  next();
});



export const requireSuperAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.agency) {
    throw AppError.forbidden("Agency association required for this action.", "SuperAdminMiddleware");
  }

  const nemaAgencyId = await getNemaAgencyId();

  logger.debug("Super admin check", {
    userAgencyType: req.user.agency.type,
    userJurisdictionLevel: req.user.agency.jurisdictionLevel,
    userRole: req.user.role,
    userAgencyId: req.user.agencyId,
    nemaAgencyId,
    expectedType: AgencyType.FEDERAL,
    expectedJurisdiction: JurisdictionLevel.NATIONAL,
    expectedRole: UserRole.ADMIN,
  });

  const isSuperAdmin = await checkIsSuperAdmin(req.user);

  if (!isSuperAdmin) {
    throw AppError.forbidden(
      "Super admin access required. Only NEMA administrators can perform this action.",
      "SuperAdminMiddleware",
      req.user
    );
  }

  next();
});

export const requireAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw AppError.unauthorized("Authentication required", "AdminMiddleware");
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw AppError.forbidden("Admin access required", "AdminMiddleware");
  }

  next();
});

export const requireAgencyAdminOrSuperAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw AppError.unauthorized("Authentication required", "AgencyAdminMiddleware");
  }

  const isSuperAdmin = await checkIsSuperAdmin(req.user);
  const isOwnAgency = req.user.role === UserRole.ADMIN && req.user.agencyId === req.params.id;

  if (!isSuperAdmin && !isOwnAgency) {
    throw AppError.forbidden(
      "Access denied. Super admin or the agency's own admin required.",
      "AgencyAdminMiddleware"
    );
  }

  next();
});

/**
 * Pre-Auth Middleware (Updated)
 * Accepts EITHER:
 * 1. 'Authorization: Bearer <JWT>' (Login Flow)
 * 2. Body { userId, token } (Password Reset Flow)
 */
export const requirePreAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;
  const authHeader = req.headers.authorization;

  // --- STRATEGY 1: Login Flow (JWT) ---
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else if (req.cookies?.preAuthToken) {
    token = req.cookies.preAuthToken;
  }

  if (token) {
    logger.debug("preAuthToken verification", { preAuthToken: token });
    const decoded = JWTService.verifyPreAuthToken(token);
    req.user = { id: decoded.userId } as any;
    //FLAG: This is a Login flow
    res.locals.isPasswordReset = false;
    return next();
  }

  // --- STRATEGY 2: Password Reset Flow (Reset Token) ---
  //This allows reusing endpoints like /2fa/resend during password reset
  const { userId, token: resetToken } = req.body;

  if (userId && resetToken) {
    try {
      // Verify validity against Redis (throws if invalid)
      await AuthService.verifyResetToken(userId, resetToken);

      // If valid, attach user ID so the controller works
      req.user = { id: userId } as any;
      // FLAG: This is a Password Reset flow
      res.locals.isPasswordReset = true;
      return next();
    } catch (error) {
      // If reset token is invalid, we proceed to throw Unauthorized below
      // or you can let the specific error bubble up if you prefer detailed messages

      throw AppError.unauthorized(`Invalid reset token or pre-auth token`, "PreAuthMiddleware", { error });
    }
  }
  // --- Fallback ---
  throw AppError.unauthorized("Pre-authentication token or valid Reset token required", "PreAuthMiddleware");
});


const checkIsSuperAdmin = async (user: Request["user"]) => {
  const nemaAgencyId = await getNemaAgencyId();
  return (
    user?.agency?.type === AgencyType.FEDERAL &&
    user?.agency?.jurisdictionLevel === JurisdictionLevel.NATIONAL &&
    user?.role === UserRole.ADMIN &&
    user?.agencyId === nemaAgencyId
  );
};
