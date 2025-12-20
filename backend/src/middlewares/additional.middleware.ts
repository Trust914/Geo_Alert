import type { NextFunction, Request, Response } from "express";
import statusCodes from "http-status-codes";
import type { Redis } from "ioredis";
import type { RateLimiterRedis } from "rate-limiter-flexible";
import { asyncHandler, requestContext } from "../utils/app.utils";
import { AppError } from "../utils/error.util";
import { logger } from "../utils/logger.util";

export const rateLimiterRedisMiddleware = (
  redisRateLimiter: RateLimiterRedis
) => {
  const handler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
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

const requestLogger = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userAgent = req.get("User-Agent");
  const request = requestContext(req);

  logger.info(
    `Received ${request.method} request to ${request.url} from ${userAgent}`,
    request
  );

  // if (req.session?.id) logger.debug(`current session ID: ${req.session.id}`);

  next();
};

export const requestLoggerMiddleware = asyncHandler(requestLogger);
