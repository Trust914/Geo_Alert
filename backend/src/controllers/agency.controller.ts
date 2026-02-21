import type { Request, Response } from "express";
import statusCodes from "http-status";
import type { AgencyStatus, AgencyType, JurisdictionLevel } from "../prisma/prisma/generated/enums.js";
import { AgencyService } from "../services/agency.service.js";
import type { IAgencyFilters, ICreateAgencyDTO, IUpdateAgencyDTO, TAgencyResponse, TAgencyStatsResponse, TCreateAgencyResponse, TDeleteAgencyResponse, TGetAgenciesResponse } from "../types/agency.types.js";
import { asyncHandler } from "../utils/app.utils.js";
import { AppError } from "../utils/error.util.js";

export class AgencyController {
  static createAgency = asyncHandler(async (req: Request, res: Response<TCreateAgencyResponse>) => {
    const createdById = req.user.id;
    const data: ICreateAgencyDTO = { createdById, ...req.body };

    const agency = await AgencyService.createAgency(data);

    res.status(statusCodes.CREATED).json({
      success: true,
      message: "Agency created successfully",
      data: agency,
    });
  });

  static getAllAgencies = asyncHandler(async (req: Request, res: Response<TGetAgenciesResponse>) => {
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

    const filters: IAgencyFilters = {
      type: req.query.type as AgencyType,
      jurisdictionLevel: req.query.jurisdictionLevel as JurisdictionLevel,
      status: req.query.status as AgencyStatus,
      search: req.query.search as string,
      pagination: req.pagination,
      sortOptions: req.sort!,
    };

    const result = await AgencyService.getAllAgencies(filters);

    res.json({
      success: true,
      message: "Agencies retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  });

  static getAgencyById = asyncHandler(async (req: Request, res: Response<TAgencyResponse>) => {
    const { id } = req.params as { id: string };

    const agency = await AgencyService.getAgencyById(id);

    res.json({
      success: true,
      message: "Agency retrieved successfully",
      data: agency,
    });
  });

  static updateAgency = asyncHandler(async (req: Request, res: Response<TAgencyResponse>) => {
    const { id } = req.params as { id: string };
    const data: IUpdateAgencyDTO = req.body;
    const userId = req.user.id;

    const agency = await AgencyService.updateAgency(id, data, userId);

    res.json({
      success: true,
      message: "Agency updated successfully",
      data: agency,
    });
  });

  static deleteAgency = asyncHandler(async (req: Request, res: Response<TDeleteAgencyResponse>) => {
    const { id } = req.params as { id: string };
    const userId = req.user.id;

    const deletedAgency = await AgencyService.deleteAgency(id, userId);

    res.json({
      success: true,
      message: "Agency deleted successfully",
      data: deletedAgency,
    });
  });

  static reactivateAgency = asyncHandler(async (req: Request, res: Response<TAgencyResponse>) => {
    const { id } = req.params as { id: string };

    const agency = await AgencyService.reactivateAgency(id);

    res.json({
      success: true,
      message: "Agency reactivated successfully",
      data: agency,
    });
  });

  static getAgencyStats = asyncHandler(async (req: Request, res: Response<TAgencyStatsResponse>) => {
    const stats = await AgencyService.getAgencyStats();

    res.json({
      success: true,
      message: "Agency statistics retrieved successfully",
      data: stats,
    });
  });
}
