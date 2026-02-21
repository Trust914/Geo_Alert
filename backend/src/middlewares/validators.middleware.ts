import type { NextFunction, Request, Response } from "express";
import statuscodes from "http-status";
import { treeifyError, z, ZodError } from "zod";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";

export const validate = (schema: z.ZodObject<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = {
        body: req.body,
        query: req.query,
        params: req.params,
      };
      logger.debug("Validating request", { data });
      await schema.parseAsync(data);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Extract readable messages from Zod errors
        const messages = error.issues.map((err) => err.message);
        const formattedMessage = `Validation Failed: ${messages.join("; ")}`;

        return next(
          new AppError({
            name: "ValidationError",
            message: formattedMessage,
            statusCode: statuscodes.BAD_REQUEST,
            handler: "ValidatorMiddleWare",
            isOperational: true,
            details: treeifyError(error), // Includes specific field-level errors
          })
        );
      }
      next(error);
    }
  };
};
