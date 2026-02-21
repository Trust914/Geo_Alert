import type { NextFunction, Request, Response } from "express";
import statusCodes from "http-status-codes";
import type { Redis } from "ioredis";
import type { RateLimiterRedis } from "rate-limiter-flexible";
import { asyncHandler, requestContext } from "../utils/app.utils.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";
import { serverConfig } from "../config/server.config.js";

export const rateLimiterRedisMiddleware = (redisRateLimiter: RateLimiterRedis) => {
  const handler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ip = req.ip ?? "unknown";
      await redisRateLimiter.consume(ip);
      next();
    } catch (error) {
      const errObj = error as Error;
      const err = new AppError({
        name: errObj.name || "RateLimitError",
        message: `Too many requests received from IP: ${req.ip}. Please try again later`,
        statusCode: statusCodes.TOO_MANY_REQUESTS,
        handler: "RateLimiterRedisMiddleware",
        isOperational: true,
      });
      next(err);
    }
  };

  return asyncHandler(handler);
};

export const addRedisClientMiddleware = (redisClient: Redis) => {
  const handler = async (req: Request, res: Response, next: NextFunction) => {
    req.redisClient = redisClient;
    next();
  };

  return asyncHandler(handler);
};

export const requestLoggerMiddleware = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userAgent = req.get("User-Agent");
  const request = requestContext(req);

  logger.info(`Received ${request.method} request to ${request.url} from ${userAgent}`, request);

  // if (req.session?.id) logger.debug(`current session ID: ${req.session.id}`);

  next();
});

// export const requestLoggerMiddleware = asyncHandler(requestLogger);

export const notFoundMiddleware = asyncHandler(async (req, res, next) => {
  throw AppError.notFound(`Route ${req.originalUrl} not found`);
});

export const paginationMiddleware = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentPageInReq = Number(req.query.currentPage);
  const limitInReq = Number(req.query.limit);

  const currentPage = currentPageInReq > 0 ? currentPageInReq : 1; // default to page 1 if current page in request query is negative
  const limit = limitInReq > 0 ? limitInReq : serverConfig.pagination.defaultLimit;
  const skip = (currentPage - 1) * limit;

  logger.debug(`currentPage: ${currentPage}`);
  req.pagination = { currentPage, limit, skip }; // set the pagination options in the request
  next();
});

export const sortMiddleware = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const sortByParam = req.query.sortBy;
  const orderParam = req.query.sortOrder;

  const reqSortBy = typeof sortByParam === "string" && serverConfig.pagination.allowedSortFields.includes(sortByParam) ? sortByParam : serverConfig.pagination.defaultSortBy; // request sortBy should be a single string

  const reqSortOrder: "asc" | "desc" = orderParam === serverConfig.pagination.defaultSortOrder ? "desc" : "asc"; // restrict to "asc" | "desc"

  const sortBy: Record<string, "asc" | "desc"> = {};

  if (reqSortBy !== undefined) {
    sortBy[reqSortBy] = reqSortOrder;
  }

  logger.debug("Sorting applied", { sortBy });
  req.sort = { sortBy }; // assign to req.sort.sortBy
  next();
});
