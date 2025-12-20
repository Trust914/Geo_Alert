import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import Redis from "ioredis";
import {
  RateLimiterRedis,
  type IRateLimiterRedisOptions,
} from "rate-limiter-flexible";
import { corsConfig } from "./config/cors.config";
import {
  endpointRateLimiter,
  redisRateLimiterOptions,
} from "./config/rateLimiters.config";
import { REDIS_CONN_CONFIG } from "./config/redis.config";
import {
  CORS_ALLOWED_URLS,
  LOCALHOST,
  NODE_ENV,
  PORT,
} from "./config/server.config";
import { prisma } from "./lib/prisma";
import {
  addRedisClientMiddleware,
  rateLimiterRedisMiddleware,
  requestLoggerMiddleware,
} from "./middlewares/additional.middleware";
import { errorHandlerMiddleware } from "./middlewares/error.middleware";
import { exitWithMessage } from "./utils/app.utils";
import { AppError } from "./utils/error.util";
import { logger } from "./utils/logger.util";

logger.debug(`${NODE_ENV} environment detected`);

const initializeRedisClient = (): Redis => {
  try {
    const client = new Redis(REDIS_CONN_CONFIG);

    client.on("error", (error) => {
      logger.error(
        `Redis connection error with config ${JSON.stringify(
          REDIS_CONN_CONFIG
        )}`,
        { name: error.name, message: error.message, stack: error.stack }
      );
      exitWithMessage(`Redis connection failed: ${error.message}`);
    });

    client.on("connect", () => {
      logger.info("Successfully connected to Redis");
    });

    return client;
  } catch (error) {
    const errObj = error as Error;
    logger.error("Failed to initialize Redis client", {
      error: errObj.message,
      stack: errObj.stack,
    });
    exitWithMessage(`Redis initialization failed: ${errObj.message}`);
    throw error;
  }
};

const configureServer = (redisClient: Redis) => {
  // Set up DDoS protection using Redis rate limiter
  const rateLimiterRedisOpts: IRateLimiterRedisOptions =
    redisRateLimiterOptions(redisClient);
  const rateLimiterRedis = new RateLimiterRedis(rateLimiterRedisOpts);
  const middlewareRateLimiterRedis =
    rateLimiterRedisMiddleware(rateLimiterRedis);

  // Set up endpoint limiter using express rate limiter
  const expressRateLimiterOpts = endpointRateLimiter(redisClient);
  const expressRateLimiter = rateLimit(expressRateLimiterOpts);

  const corsOpts = corsConfig(CORS_ALLOWED_URLS);
  const app = express();

  // Apply middleware
  app.use(cors(corsOpts));
  app.use(helmet());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(middlewareRateLimiterRedis);
  app.use(requestLoggerMiddleware);
  app.use(cookieParser());
  // app.use(sessionMiddleware)

  // Route-specific middleware
  app.use("/api/user/", expressRateLimiter); // add sensitive route protection
  app.use("/api/user/", addRedisClientMiddleware(redisClient));

  // Routes

  // Central error handler
  app.use(errorHandlerMiddleware);

  return app;
};

const startServer = async () => {
  try {
    // Initialize Redis
    const redisClient = initializeRedisClient();

    // Connect to PostgreSQL DB
    logger.warn("Attempting to connect to the database...");
    await prisma.$connect();
    logger.info("Successfully connected to the database");

    // Configure and start Express server
    const app = configureServer(redisClient);

    app
      .listen(PORT, () => {
        logger.info(`User Service has started at http://${LOCALHOST}:${PORT}`);
      })
      .on("error", (error) => {
        logger.fatal(`Error while starting the server on port ${PORT}`, {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
        exitWithMessage(`Server startup failed: ${error.message}`);
      });
  } catch (error) {
    const errObj = error as Error;
    logger.fatal(`Failed to start server: ${errObj.message}`, {
      stack: errObj.stack,
    });
    exitWithMessage(`Failed to start server: ${errObj.message}`);
  }
};

// Register global error handlers
const setupProcessErrorHandlers = () => {
  process.on("unhandledRejection", (reason) => {
    let err: Record<string, any>;
    if (reason instanceof Error || reason instanceof AppError) {
      err = {
        name: reason?.name || "UnknownRejection",
        message: reason?.message || String(reason),
        stack: reason?.stack,
        cause: reason?.cause,
      };
    } else {
      err = {
        name: "UnknownRejection",
        message: String(reason),
      };
    }

    logger.fatal("UNHANDLED_REJECTION", err);
    exitWithMessage(`Unhandled rejection: ${err.message}`);
  });

  process.on("uncaughtException", (error) => {
    const err = {
      name: error?.name || "UnknownException",
      message: error?.message || String(error),
      stack: error?.stack,
      cause: error?.cause,
    };
    logger.fatal("UNCAUGHT_EXCEPTION", err);
    exitWithMessage(`Uncaught exception: ${err.message}`);
  });

  // Clean shutdown for SIGTERM and SIGINT
  process.on("SIGTERM", () => exitWithMessage("SIGTERM received", 0));
  process.on("SIGINT", () => exitWithMessage("SIGINT received", 0));
};

// Main execution
setupProcessErrorHandlers();
startServer();
