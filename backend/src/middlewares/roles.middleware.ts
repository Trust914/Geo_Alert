import type { NextFunction, Request, Response } from "express";
import { UserRole } from "../prisma/prisma/generated/enums.js";
import { asyncHandler } from "../utils/app.utils.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";

export const checkRole = (allowedRoles: UserRole[]) => {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw AppError.unauthorized("Authentication required", "RoleMiddleware");
      }

      const userRole = req.user.role as UserRole;

      if (!allowedRoles.includes(userRole)) {
        logger.warn("Unauthorized role access attempt", {
          userId: req.user.id,
          userRole,
          requiredRoles: allowedRoles,
          path: req.path,
        });

        throw AppError.forbidden(`Access denied. Required role(s): ${allowedRoles.join(", ")}`, "RoleMiddleware");
      }

      next();
    } catch (error) {
      next(error);
    }
  });
};

export const isAdminOrCoordinator = (req: Request, res: Response, next: NextFunction) => {
  checkRole([UserRole.ADMIN, UserRole.COORDINATOR])(req, res, next);
};

export const requireAlertWriteAccess = (req: Request, res: Response, next: NextFunction) => {
  checkRole([UserRole.ADMIN, UserRole.COORDINATOR, UserRole.OPERATOR])(req, res, next);
};

export const canViewSensitiveData = (req: Request, res: Response, next: NextFunction) => {
  checkRole([UserRole.ADMIN, UserRole.COORDINATOR])(req, res, next);
};
