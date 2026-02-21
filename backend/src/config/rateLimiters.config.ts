import statusCodes from "http-status";
import Redis from "ioredis";
import type { RedisReply } from "rate-limit-redis";
import { RedisStore } from "rate-limit-redis";

import type { NextFunction, Request, Response } from "express";
import { ipKeyGenerator } from "express-rate-limit"; // Add this import
import type { IRateLimiterRedisOptions } from "rate-limiter-flexible";
import { AppError } from "../utils/error.util.js";
import { cacheConstants } from "./cache.constants.js";
import { serverConfig } from "./server.config.js";

type KeyGenerator = (req: Request) => string | Promise<string>;

export const createKeyGenerator = (prefix: string): KeyGenerator => {
  return (req: Request): string => {
    // Priority 1: Use authenticated user ID (prevents shared IP issues)
    if (req.user?.id) {
      return `${prefix}:user:${req.user.id}`;
    }

    // Priority 2: Use IP address with the helper function
    const ip = req.ip || "unknown"; // Provide a default fallback
    const ipKey = ipKeyGenerator(ip);
    return `${prefix}:ip:${ipKey}`;
  };
};

export const endpointRateLimiter = (redisClient: Redis) => {
  return {
    windowMs: serverConfig.rateLimiting.endpointLimitTime,
    limit: serverConfig.rateLimiting.endpointLimit,
    standardHeaders: true,
    legacyHeaders: true,

    keyGenerator: createKeyGenerator("rl:endpoint"),
    handler: (req: Request, res: Response, next: NextFunction) => {
      const identifier = req.user?.id ? `user ${req.user.id}` : `IP ${req.ip}`;

      const err = new AppError({
        name: "RateLimitError",
        message: `Too many requests from ${identifier}. Please wait 1 minute before trying again.`,
        statusCode: statusCodes.TOO_MANY_REQUESTS,
        handler: "EndpointRateLimiter",
        isOperational: true,
      });

      next(err);
    },
    store: new RedisStore({
      sendCommand: async (...args: Parameters<typeof redisClient.call>): Promise<RedisReply> => {
        const result = await redisClient.call(...args);
        return result as RedisReply;
      },
      prefix: "rl:endpoint:",
    }),
  };
};

export const loginRateLimiter = (redisClient: Redis) => {
  return {
    windowMs: cacheConstants.ttl.MEDIUM * 1000,
    limit: serverConfig.rateLimiting.loginMaxAttempts,
    standardHeaders: true,
    legacyHeaders: false,

    // Use ipKeyGenerator helper for IPv6 compliance
    keyGenerator: (req: Request): string => {
      const ipKey = ipKeyGenerator(req.ip as string);
      return `rl:login:ip:${ipKey}`;
    },

    skipSuccessfulRequests: true,

    handler: (req: Request, res: Response, next: NextFunction) => {
      const err = new AppError({
        name: "LoginRateLimitError",
        message: "Too many login attempts. Please try again in 15 minutes.",
        statusCode: statusCodes.TOO_MANY_REQUESTS,
        handler: "LoginRateLimiter",
        isOperational: true,
      });
      next(err);
    },

    store: new RedisStore({
      sendCommand: async (...args: Parameters<typeof redisClient.call>): Promise<RedisReply> => {
        return (await redisClient.call(...args)) as RedisReply;
      },
      prefix: "rl:login:",
    }),
  };
};

export const redisRateLimiterOptions = (redisClient: Redis): IRateLimiterRedisOptions => {
  return {
    storeClient: redisClient,
    points: serverConfig.rateLimiting.redisMaxPoints,
    duration: serverConfig.rateLimiting.redisDuration,
    keyPrefix: "rl:ddos:",
    blockDuration: serverConfig.rateLimiting.redisBlockDuration,
    execEvenly: false,
  };
};
