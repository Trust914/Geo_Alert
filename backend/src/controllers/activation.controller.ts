import type { Request, Response } from "express";
import statusCodes from "http-status";
import { ActivationService } from "../services/activation.service.js";
import type { TCompleteActivationResponse, TResendActivationResponse, TVerifyActivationResponse } from "../types/activation.types.js";
import { asyncHandler } from "../utils/app.utils.js";
import { AppError } from "../utils/error.util.js";

export class ActivationController {
  /**
   * Verify activation token (GET request from email link)
   */
  static verifyActivationToken = asyncHandler(async (req: Request, res: Response<TVerifyActivationResponse>) => {
    const { token, userId } = req.query;

    if (!token || !userId) {
      throw AppError.badRequest("Token and userId are required", "ActivationController");
    }

    const result = await ActivationService.verifyActivationToken(userId as string, token as string);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Activation token is valid",
      data: {
        email: result.email,
        accountType: result.accountType,
      },
    });
  });

  /**
   * Complete activation - user sets password (POST request)
   */
  static completeActivation = asyncHandler(async (req: Request, res: Response<TCompleteActivationResponse>) => {
    const { userId, token, password } = req.body;

    if (!userId || !token || !password) {
      throw AppError.badRequest("userId, token, and password are required", "ActivationController");
    }

    await ActivationService.completeActivation(userId, token, password);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Account activated successfully. You can now login.",
    });
  });

  /**
   * Resend activation email
   */
  static resendActivationEmail = asyncHandler(async (req: Request, res: Response<TResendActivationResponse>) => {
    const { userId } = req.body;

    if (!userId) {
      throw AppError.badRequest("userId is required", "ActivationController");
    }

    await ActivationService.resendActivationEmail(userId);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Activation email sent successfully",
    });
  });
}
