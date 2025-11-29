import statusCodes from "http-status";
import Redis from "ioredis";
import type { RedisReply } from "rate-limit-redis";
import { RedisStore } from "rate-limit-redis";

import type { NextFunction, Request, Response } from "express";
import type {
  IRateLimiterOptions,
  IRateLimiterRedisOptions,
} from "rate-limiter-flexible";
import { AppError } from "../utils/error.util.js";
import {
  ENDPOINT_LIMIT,
  ENDPOINT_LIMIT_TIME,
  RATELIMITER_REDIS_BLOCK_DURATION,
  RATELIMITER_REDIS_DURATION,
  RATELIMITER_REDIS_MAX_POINTS,
} from "./server.config.js";

export const endpointRateLimiter = (redisClient: Redis) => {
  // express-rate-limit (with Redis as store for sensitive API routes)
  return {
    windowMs: ENDPOINT_LIMIT_TIME * 60 * 1000, // e.g, 15 * 60 * 1000 = 15 minutes
    limit: ENDPOINT_LIMIT, // Limit each IP to specified num of  requests per `window` (here,e.g., per 15 minutes).
    standardHeaders: true,
    legacyHeaders: true,
    handler: (req: Request, res: Response, next: NextFunction) => {
      const err = new AppError({
        name: `RateLimitError`,
        message: `Sensitive endpoint rate limit exceeded for IP: ${req.ip}`,
        statusCode: statusCodes.TOO_MANY_REQUESTS,
        handler: "EndpointRateLimitConfig",
        isOperational: true,
      });

      next(err);
    },
    store: new RedisStore({
      // Store the request counts in Redis
      sendCommand: async (
        ...args: Parameters<typeof redisClient.call>
      ): Promise<RedisReply> => {
        const result = await redisClient.call(...args);
        return result as RedisReply;
      },
    }),
  };
};

export const redisRateLimiterOptions = (
  redisClient: Redis
): IRateLimiterRedisOptions => {
  return {
    storeClient: redisClient,
    points: RATELIMITER_REDIS_MAX_POINTS,
    duration: RATELIMITER_REDIS_DURATION,
    keyPrefix: "redis-rate-limiter-middleware",
    blockDuration: RATELIMITER_REDIS_BLOCK_DURATION,
  };
};
