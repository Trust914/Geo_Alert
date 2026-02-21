import type { Request, Response } from "express";
import { USSDService } from "../services/ussd/ussd.service.js";
import type { IUSSDWebhookPayload } from "../types/ussd.types.js";
import { asyncHandler } from "../utils/app.utils.js";
import { AppError } from "../utils/error.util.js";

export class USSDController {
  /**
   * Handle USSD callback from Africa's Talking
   */
  static handleUSSD = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body as IUSSDWebhookPayload;

    if (!sessionId || !phoneNumber) {
      throw AppError.badRequest("Invalid USSD Payload", "USSDController");
    }

    const response = await USSDService.handleUSSD(sessionId, phoneNumber, text);

    res.set("Content-Type", "text/plain");
    res.send(response);
  });
}
