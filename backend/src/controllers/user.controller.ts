import type { Request, Response } from "express";
import statusCodes from "http-status";
import type { UserRole } from "../prisma/prisma/generated/enums.js";
import { UserService } from "../services/user.service.js";
import type { IUserFilters, TUserListResponse, TUserMessageResponse, TUserResponse } from "../types/user.types.js";
import { asyncHandler } from "../utils/app.utils.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";

export class UserController {
  static createUser = asyncHandler(async (req: Request, res: Response<TUserResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "UserController");
    }

    const data = req.body;
    const creatorUserId = req.user.id as string;

    const user = await UserService.createUser(data, creatorUserId);

    res.status(statusCodes.CREATED).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  });

  static getAgencyUsers = asyncHandler(async (req: Request, res: Response<TUserListResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "UserController");
    }

    const { agencyId } = req.params;
    const requestingUserId = req.user.id as string;

    //Validate pagination exists (should be added by middleware)
    if (!req.pagination) {
      throw AppError.internal("Pagination middleware not applied", null, "AuthController");
    }

    // ✅ FIX: Only set isActive if the query parameter is explicitly provided
    const filters: IUserFilters = {
      role: req.query.role as UserRole,
      isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
      search: req.query.search as string,
      pagination: req.pagination,
      sortOptions: req.sort!,
    };

    logger.debug("Filters in getAgencyUsers controller:", { filters });
    const result = await UserService.getAgencyUsers(agencyId as string, filters, requestingUserId);

    logger.debug("Result from UserService.getAgencyUsers:", { result });

    res.status(statusCodes.OK).json({
      success: true,
      message: "Users retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  });

  static getAllUsers = asyncHandler(async (req: Request, res: Response<TUserListResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "UserController");
    }

    if (!req.pagination) {
      throw AppError.internal("Pagination middleware not applied", null, "UserController");
    }

    const filters: IUserFilters = {
      role: req.query.role as UserRole,
      isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
      search: req.query.search as string,
      pagination: req.pagination,
      sortOptions: req.sort!,
    };

    const result = await UserService.getAllUsers(filters, req.user.id as string);
    logger.debug("Result from UserService.getAllUsers:", { result });

    res.status(statusCodes.OK).json({
      success: true,
      message: "All users retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  });

  static getUserById = asyncHandler(async (req: Request, res: Response<TUserResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "UserController");
    }

    const { id } = req.params;
    const requestingUserId = req.user.id as string;

    const user = await UserService.getUserById(String(id), requestingUserId);

    res.status(statusCodes.OK).json({
      success: true,
      message: "User retrieved successfully",
      data: user,
    });
  });

  static updateUser = asyncHandler(async (req: Request, res: Response<TUserResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "UserController");
    }

    const { id } = req.params;
    const data = req.body;
    const requestingUserId = req.user.id as string;

    const user = await UserService.updateUser(String(id), data, requestingUserId);

    res.status(statusCodes.OK).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  });

  static deactivateUser = asyncHandler(async (req: Request, res: Response<TUserMessageResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "UserController");
    }

    const { id } = req.params;
    const requestingUserId = req.user.id as string;

    await UserService.deactivateUser(String(id), requestingUserId);

    res.status(statusCodes.OK).json({
      success: true,
      message: "User deactivated successfully",
    });
  });

  static reactivateUser = asyncHandler(async (req: Request, res: Response<TUserMessageResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "UserController");
    }

    const { id } = req.params;
    const requestingUserId = req.user.id as string;

    await UserService.reactivateUser(String(id), requestingUserId);

    res.status(statusCodes.OK).json({
      success: true,
      message: "User reactivated successfully",
    });
  });

  static resetUserPassword = asyncHandler(async (req: Request, res: Response<TUserMessageResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "UserController");
    }

    const { id } = req.params;
    const requestingUserId = req.user.id as string;

    await UserService.resetUserPassword(String(id), requestingUserId);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Password reset successfully. User will be required to change password on next login.",
    });
  });
}
