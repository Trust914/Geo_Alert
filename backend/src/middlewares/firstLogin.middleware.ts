import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/app.utils.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";

export const checkPasswordChangeRequired = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug("checking if user must change password");
  if (!req.user || !req.user.id) {
    return next();
  }
  logger.debug("checking if user must change password next line");

  // Skip check for password change endpoint
  if (req.path.includes("/change-password") || req.path.includes("/logout")) {
    return next();
  }

  // Get user's mustChangePassword status
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { mustChangePassword: true },
  });

  if (user?.mustChangePassword) {
    throw AppError.forbidden("You must change your password before accessing this resource. Please use the /api/v1/auth/change-password endpoint.", "PasswordChangeRequired");
  }

  next();
});
