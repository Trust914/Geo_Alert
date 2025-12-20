import type { NextFunction, Request, Response } from "express";
import fs from "fs";
import statusCodes from "http-status";
import path from "path";
import { AppError } from "./error.util.js";
import { logger } from "./logger.util.js";

export const getEnvVariable = (key: string) => {
  const value = process.env[key];
  if (value === undefined) {
    console.warn(
      `Environment variable ${key} is not defined and no default value provided`
    );
  }
  return value;
};

export const chooseEnvValue = (devValue: string, prodValue: string): string => {
  const nodeEnv = getEnvVariable("NODE_ENV");
  return nodeEnv === "development" ? devValue : prodValue;
};

export const checkIfDefined = <T>(val: T | undefined, name: string): T => {
  if (val === undefined || val == null) {
    throw new AppError({
      name: "ParameterError",
      message: `Parameter :${name} is required but is undefined`,
      statusCode: statusCodes.BAD_REQUEST,
      handler: "CheckIfDefinedUtil",
      isOperational: true,
      details: { val },
    });
  }
  return val;
};

export const hideSensitiveKeys = (
  originObj: Record<string, string | number>,
  sensitiveKeys: Array<string>
): Record<string, string | number> | null => {
  //   const sensitiveKeys = ["password", "token"];
  // console.log("originreq type of", typeof originObj)
  const keys = Object.keys(originObj);
  if (keys.length === 0) {
    logger.warn("No origin Object recieved in hideSensitivekeys");
    return null;
  }
  const newObj: Record<string, string | number> = {};
  for (let key in originObj) {
    if (sensitiveKeys.includes(key)) {
      newObj[key] = "**HIDDEN**";
    } else {
      newObj[key] = originObj[key] !== undefined ? originObj[key] : "";
    }
  }
  return newObj;
};

export const requestContext = (req: Request) => {
  const sensitiveKeys = ["password", "oldPasswordReq", "newPassword"];
  return {
    method: req.method,
    url: req.originalUrl,
    user: req.user?._id || "anonymous",
    ip: req.ip,
    params: req.params || null,
    query: req.query || null,
    ...(req.body && { body: hideSensitiveKeys(req.body, sensitiveKeys) }),
  };
};


export const asyncHandler = <T = any>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T> | T,
  options?: {
    errorMessage?: string;
    statusCode?: number;
    handler?: string;
  }
) => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> | void => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // If it's already an AppError, just forward it
      if (error instanceof AppError) {
        return next(error);
      }

      // Convert to AppError with custom options
      const appError = new AppError({
        name: error.name || `AsyncHandlerError-${error.name}`,
        message:
          options?.errorMessage ||
          error.message ||
          "An unexpected error occurred",
        statusCode: options?.statusCode || 500,
        handler: options?.handler || "AsyncHandler",
        isOperational: true,
        cause: error,
      });

      next(appError);
    });
  };
};

// Erro Response for Development (Verbose)
export const sendErrorDev = (err: AppError, res: Response) => {
  res.status(err.statusCode).json({
    success: false,
    error: {
      name: err.name,
      message: err.message,
      statusCode: err.statusCode,
      details: err.details,
      stack: err.stack,
      cause: err.cause instanceof Error ? err.cause.message : err.cause,
    },
  });
};

// Error Response for Production
export const sendErrorProd = (err: AppError, res: Response) => {
  if (err.isOperational) { // Operational, trusted error: send message to client
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message, 
        details: Object.keys(err.details).length ? err.details : undefined,
      },
    });
  }

  // Programming or other unknown error: don't leak error details
  return res.status(500).json({
    success: false,
    error: {
      message: "Something went wrong. Please try again later.",
    },
  });
};

export const exitWithMessage = (message: string, code: number = 1): void => {
  logger.warn(`Exiting application: ${message}`);
  // Wait for log message to be printed before exiting
  setTimeout(() => {
    process.exit(code);
  }, 200);
};