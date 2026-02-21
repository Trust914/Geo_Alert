import type { NextFunction, Request, Response } from "express";
import statusCodes from "http-status";
import { cacheConstants} from "../config/cache.constants.js";
import { prisma } from "../lib/prisma.js";
import { AgencyType, DeliveryStatus, JurisdictionLevel } from "../prisma/prisma/generated/enums.js";
import { getCacheService } from "../services/cache.service.js";
import { AppError } from "./error.util.js";
import { logger } from "./logger.util.js";

export const hideSensitiveKeys = (
  originObj: Record<string, string | number>,
  sensitiveKeys: Array<string>
): Record<string, string | number> | null => {
  const keys = Object.keys(originObj);

  // Return null if object is empty or undefined
  if (!originObj || keys.length === 0) {
    logger.warn("No origin Object received in hideSensitiveKeys");
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

  const context: Record<string, any> = {
    method: req.method,
    url: req.originalUrl,
    user: req.user?.id || "anonymous",
    ip: req.ip,
    params: req.params || null,
    query: req.query || null,
  };

  // Only add body if it exists and has content
  if (req.body && Object.keys(req.body).length > 0) {
    context.body = hideSensitiveKeys(req.body, sensitiveKeys);
  }

  return context;
};

export const asyncHandler = <T = any>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T> | T,
  options?: {
    errorMessage?: string;
    statusCode?: number;
    handler?: string;
  }
) => {
  return (req: Request, res: Response, next: NextFunction): Promise<void> | void => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // If it's already an AppError, just forward it
      if (error instanceof AppError) {
        return next(error);
      }

      // Convert to AppError with custom options
      const appError = new AppError({
        name: error.name || `AsyncHandlerError-${error.name}`,
        message: options?.errorMessage || error.message || "An unexpected error occurred",
        statusCode: options?.statusCode || 500,
        handler: options?.handler || "AsyncHandler",
        isOperational: true,
        cause: error,
      });

      next(appError);
    });
  };
};

// Erro Response for Development
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
  if (err.isOperational) {
    // Operational, trusted error: send message to client
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        details: Object.keys(err.details).length ? err.details : undefined,
      },
    });
  }

  // Programming or other unknown error: don't leak error details
  return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
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

export const getNemaAgencyId = async (): Promise<string> => {
  const cache = getCacheService(); // Initialize cache service first

  // Now call getOrSet
  return await cache.getOrSet<string>(
    cacheConstants.keys.AGENCY.NEMA_ID,
    "system", // identifier
    async () => {
      // Fetcher function (runs only on cache miss)
      const nema = await prisma.agency.findFirst({
        where: {
          type: AgencyType.FEDERAL,
          jurisdictionLevel: JurisdictionLevel.NATIONAL,
          name: "National Emergency Management Agency",
        },
        select: { id: true },
      });

      if (!nema) {
        throw AppError.internal("Critical System Error: NEMA Agency configuration not found.", null, "NemaHelper");
      }
      return nema.id;
    },
    cacheConstants.ttl.VERY_LONG
  );
};

export const mapStatusToEnum = (atStatus: string): DeliveryStatus => {
  const status = atStatus.toLowerCase();

  switch (status) {
    case "success":
      return DeliveryStatus.DELIVERED;
    case "failed":
      return DeliveryStatus.FAILED;
    case "rejected":
      return DeliveryStatus.FAILED;
    case "buffered":
      return DeliveryStatus.QUEUED;
    case "submitted":
      return DeliveryStatus.SENT;
    case "inbox":
      return DeliveryStatus.DELIVERED;
    default:
      return DeliveryStatus.SENT;
  }
};

/**
 * Formats bytes into human-readable strings (KB, MB, GB)
 */
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

/**
 * Formats CPU usage (microseconds) into seconds
 */
export const formatCpuTime = (cpuUsage: NodeJS.CpuUsage) => {
  return {
    userProcessTime: `${(cpuUsage.user / 1_000_000).toFixed(2)}s`,
    osSystemTime: `${(cpuUsage.system / 1_000_000).toFixed(2)}s`,
  };
};

/**
 * Formats uptime seconds into readable string (e.g. "2h 15m 10s")
 */
export const formatUptime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
};
