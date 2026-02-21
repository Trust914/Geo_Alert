import type { Request, Response } from "express";
import statusCodes from "http-status";
import { CitizenService } from "../services/citizen.service.js";
import type {
  CitizenFilters,
  TCitizenListResponse,
  TCitizenMessageResponse,
  TCitizenNearbyResponse,
  TCitizenResponse,
  TCitizenStatsResponse,
} from "../types/citizen.types.js";
import { asyncHandler } from "../utils/app.utils.js";
import { AppError } from "../utils/error.util.js";

export class CitizenController {
  /**
   * Register a new citizen
   */
  static registerCitizen = asyncHandler(async (req: Request, res: Response<TCitizenResponse>) => {
    const data = req.body;
    const citizen = await CitizenService.registerCitizen(data);

    res.status(statusCodes.CREATED).json({
      success: true,
      message: "Citizen registered successfully",
      data: citizen,
    });
  });

  /**
   * Get citizen by phone number
   */
  static getCitizenByPhone = asyncHandler(async (req: Request, res: Response<TCitizenResponse>) => {
    const { phoneNumber } = req.params;
    const citizen = await CitizenService.getCitizenByPhone(phoneNumber as string);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Citizen retrieved",
      data: citizen,
    });
  });

  /**
   * Get citizen by ID
   */
  static getCitizenById = asyncHandler(async (req: Request, res: Response<TCitizenResponse>) => {
    const { id } = req.params;
    const citizen = await CitizenService.getCitizenById(id as string);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Citizen retrieved",
      data: citizen,
    });
  });

  /**
   * Update citizen information
   */
  static updateCitizen = asyncHandler(async (req: Request, res: Response<TCitizenResponse>) => {
    const { phoneNumber } = req.params;
    const data = req.body;
    const citizen = await CitizenService.updateCitizen(phoneNumber as string, data);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Citizen updated successfully",
      data: citizen,
    });
  });

  /**
   * Opt-in citizen
   */
  static optIn = asyncHandler(async (req: Request, res: Response<TCitizenMessageResponse>) => {
    const { phoneNumber } = req.params;
    await CitizenService.toggleOptIn(phoneNumber as string, true);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Citizen opted in successfully",
    });
  });

  /**
   * Opt-out citizen
   */
  static optOut = asyncHandler(async (req: Request, res: Response<TCitizenMessageResponse>) => {
    const { phoneNumber } = req.params;
    await CitizenService.toggleOptIn(phoneNumber as string, false);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Citizen opted out successfully",
    });
  });

  /**
   * Get citizens with filters
   */
  static getCitizens = asyncHandler(async (req: Request, res: Response<TCitizenListResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "AuthController");
    }

    const userId = req.user.id;
    if (!userId) {
      throw AppError.badRequest("User ID is required", "AuthController");
    }

    //Validate pagination exists (should be added by middleware)
    if (!req.pagination) {
      throw AppError.internal("Pagination middleware not applied", null, "AuthController");
    }
    const filters: CitizenFilters = {
      stateId: req.query.stateId as string,
      lgaId: req.query.lgaId as string,
      wardId: req.query.wardId as string,
      isOptedIn: req.query.isOptedIn === "true",
      search: req.query.search as string,
      pagination: req.pagination,
    };

    const result = await CitizenService.getCitizens(filters);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Citizens retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  });

  /**
   * Get citizens nearby
   */
  static getCitizensNearby = asyncHandler(async (req: Request, res: Response<TCitizenNearbyResponse>) => {
    const { latitude, longitude, radiusKm } = req.query;
    const citizens = await CitizenService.getCitizensNearby(
      parseFloat(latitude as string),
      parseFloat(longitude as string),
      parseInt(radiusKm as string)
    );

    res.status(statusCodes.OK).json({
      success: true,
      message: "Nearby citizens retrieved",
      data: citizens,
    });
  });

  /**
   * Get citizen statistics
   */
  static getStatistics = asyncHandler(async (req: Request, res: Response<TCitizenStatsResponse>) => {
    const stats = await CitizenService.getStatistics();

    res.status(statusCodes.OK).json({
      message: "Statistics retrieved",
      success: true,
      data: stats,
    });
  });
}
