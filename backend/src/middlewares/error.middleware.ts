import type { NextFunction, Request, Response } from "express";
import { IS_DEV_ENV, IS_STAGING_ENV } from "../config/server.config.js";
import { requestContext, sendErrorDev, sendErrorProd } from "../utils/app.utils.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";

export const errorHandlerMiddleware = (
  err: Error | AppError | any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Ensure everything is an AppError
  let error = err;
  if (!(error instanceof AppError)) {
    error = new AppError({
      name: error.name || "UnknownError",
      message: error.message || "An unexpected error occurred",
      statusCode: 500,
      handler: "GlobalErrorHandler",
      isOperational: false, 
      cause: err,
    });
  }

  // Contextual Logging (Always log full details on the server)
  const errReqContext = requestContext(req);
  logger.error(error.message, {
    name: error.name,
    statusCode: error.statusCode,
    handler: error.handler,
    req: errReqContext,
    details: error.details,
    stack: error.stack, // Always log stack on server
    cause: error.cause,
  });

  // Send Response based on Environment
  if (IS_DEV_ENV || IS_STAGING_ENV) {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};