import type { Request, Response } from "express";
import statusCodes from "http-status";
import { LocationService } from "../services/location.service.js";
import { asyncHandler } from "../utils/app.utils.js";
import type { IApiResponse } from "../types/api.response.js";

export class LocationController {
  static getStates = asyncHandler(async (req: Request, res: Response<IApiResponse>) => {
    const states = await LocationService.getStates();

    res.status(statusCodes.OK).json({
      success: true,
      message: "States retrieved successfully",
      data: states,
    });
  });

  static getLgas = asyncHandler(async (req: Request, res: Response<IApiResponse>) => {
    const { stateId } = req.params;
    const lgas = await LocationService.getLgasByStateId(stateId!);

    res.status(statusCodes.OK).json({
      success: true,
      message: "LGAs retrieved successfully",
      data: lgas,
    });
  });

  static getWards = asyncHandler(async (req: Request, res: Response<IApiResponse>) => {
    const { lgaId } = req.params;
    const wards = await LocationService.getWardsByLgaId(lgaId!);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Wards retrieved successfully",
      data: wards,
    });
  });
}