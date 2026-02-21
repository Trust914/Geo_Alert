import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import Redis from "ioredis";
import { RateLimiterRedis, type IRateLimiterRedisOptions } from "rate-limiter-flexible";
import { corsConfig } from "./config/cors.config.js";
import { endpointRateLimiter, loginRateLimiter, redisRateLimiterOptions } from "./config/rateLimiters.config.js";
import { prisma } from "./lib/prisma.js";
import { addRedisClientMiddleware, notFoundMiddleware, rateLimiterRedisMiddleware, requestLoggerMiddleware } from "./middlewares/additional.middleware.js";
import { errorHandlerMiddleware } from "./middlewares/error.middleware.js";
import { exitWithMessage } from "./utils/app.utils.js";
import { AppError } from "./utils/error.util.js";
import { logger } from "./utils/logger.util.js";
import { initializeCacheService } from "./services/cache.service.js";
import authRoutes from "./routes/auth.routes.js";
import bffAuthRoutes from "./routes/bff.routes.js";
import agencyRoutes from "./routes/agency.routes.js";
import healthRoutes from "./routes/health.route.js";
import userRoutes from "./routes/user.routes.js";
import citizenRoutes from "./routes/citizen.route.js";
import alertRoutes from "./routes/alert.routes.js";
import smsRoutes from "./routes/sms.routes.js";
import ussdRoutes from "./routes/ussd.routes.js";
import twoFactorAuthRoutes from "./routes/twoFactorAuth.routes.js";
import activationRoutes from "./routes/activation.routes.js";
import { RabbitMQService } from "./rabbitmq/rabbitmq.queue.js";
import { closeRabbitMQConnection } from "./utils/rabbitmq.util.js";
import { startWorkers } from "./rabbitmq/rabbitmq.workers.js";
import locationRoutes from "./routes/location.routes.js";
import { serverConfig } from "./config/server.config.js";
import { redisConfig } from "./config/redis.config.js";

logger.debug(`${serverConfig.app.environment.toLocaleUpperCase()} environment detected`);
// logger.debug(`Africa's Talking sender config: ${JSON.stringify(AT_CONFIG, null, 2)}`);

const initializeRedisClient = (): Redis => {
  try {
    const client = new Redis(redisConfig.connection);

    client.on("error", (error) => {
      logger.error(`Redis connection error with config ${JSON.stringify(redisConfig.connection)}`, { name: error.name, message: error.message, stack: error.stack });
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

/**
 * Initialize RabbitMQ connection
 * @returns Promise that resolves when connected or rejects on failure
 */
const initializeRabbitMQConnection = async (): Promise<void> => {
  try {
    logger.warn("Connecting to RabbitMQ message broker...");
    await RabbitMQService.initialize();
    // logger.info("Successfully connected to the RabbitMQ message broker");

    logger.warn("Initialising workers for Event listener in the Message broker....");
    await startWorkers();
    logger.info("Successfully initialized RabbitMQ event listener");
  } catch (mqError) {
    const mqErrorObj = mqError as Error;
    logger.error(`RabbitMQ initialization failed: ${mqErrorObj.message}`, {
      stack: mqErrorObj.stack,
    });
    await closeRabbitMQConnection();
    exitWithMessage(`RabbitMQ initialization failed: ${mqErrorObj.message}`);
  }
};

const configureServer = (redisClient: Redis) => {
  // Initialize cache service with Redis client
  initializeCacheService(redisClient);
  logger.info("Cache service initialized successfully");

  // Set up DDoS protection using Redis rate limiter
  const rateLimiterRedisOpts: IRateLimiterRedisOptions = redisRateLimiterOptions(redisClient);
  const rateLimiterRedis = new RateLimiterRedis(rateLimiterRedisOpts);
  const middlewareRateLimiterRedis = rateLimiterRedisMiddleware(rateLimiterRedis);

  // Set up endpoint limiter using express rate limiter
  const expressRateLimiterOpts = endpointRateLimiter(redisClient);
  const expressRateLimiter = rateLimit(expressRateLimiterOpts);

  // Login-specific rate limiter (tighter limits)
  const sensitiveRouteLimiter = rateLimit(loginRateLimiter(redisClient));

  const corsOpts = corsConfig(serverConfig.cors.allowedUrls);
  const app = express();

  if (serverConfig.app.isProd) {
    // Trust first proxy (load balancer)
    app.set("trust proxy", 1);
    logger.info("Trust proxy enabled for production");
  } else {
    // In development, trust loopback
    app.set("trust proxy", "loopback");
    logger.info("Trust proxy enabled for development (loopback)");
  }

  // Apply middleware
  app.use(cors(corsOpts));
  app.use(helmet());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use(middlewareRateLimiterRedis);
  app.use(requestLoggerMiddleware);

  // Health check
  const apiRoot = `/api/${serverConfig.app.version}`;

  app.use(`${apiRoot}/health`, addRedisClientMiddleware(redisClient), healthRoutes);

  // User Account Activation Routes
  app.use(`${apiRoot}/activation`, sensitiveRouteLimiter);
  app.use(`${apiRoot}/activation`, addRedisClientMiddleware(redisClient));
  app.use(`${apiRoot}/activation`, activationRoutes);

  // Auth routes
  app.use(`${apiRoot}/auth/login`, sensitiveRouteLimiter); // 5 attempts per 15 min
  app.use(`${apiRoot}/auth`, expressRateLimiter); // 30 req/min for other auth
  app.use(`${apiRoot}/auth`, addRedisClientMiddleware(redisClient));
  app.use(`${apiRoot}/auth`, authRoutes);

  // Auth routes
  app.use(`${apiRoot}/bff/login`, sensitiveRouteLimiter); // 5 attempts per 15 min
  app.use(`${apiRoot}/bff`, expressRateLimiter); // 30 req/min for other auth
  app.use(`${apiRoot}/bff`, addRedisClientMiddleware(redisClient));
  app.use(`${apiRoot}/bff`, bffAuthRoutes);

  app.use(`${apiRoot}/two-factor`, sensitiveRouteLimiter);
  app.use(`${apiRoot}/two-factor`, addRedisClientMiddleware(redisClient));
  app.use(`${apiRoot}/two-factor`, twoFactorAuthRoutes);

  // User routes
  app.use(`${apiRoot}/user`, expressRateLimiter); // 30 req/min
  app.use(`${apiRoot}/user`, addRedisClientMiddleware(redisClient));
  app.use(`${apiRoot}/user`, userRoutes);

  // Agency routes
  app.use(`${apiRoot}/agency`, expressRateLimiter); // 30 req/min
  app.use(`${apiRoot}/agency`, addRedisClientMiddleware(redisClient));
  app.use(`${apiRoot}/agency`, agencyRoutes);

  // Citizen routes
  app.use(`${apiRoot}/citizen`, expressRateLimiter); // 30 req/min
  app.use(`${apiRoot}/citizen`, addRedisClientMiddleware(redisClient));
  app.use(`${apiRoot}/citizen`, citizenRoutes);

  // Alert routes
  app.use(`${apiRoot}/alert`, expressRateLimiter); // 30 req/min
  app.use(`${apiRoot}/alert`, addRedisClientMiddleware(redisClient));
  app.use(`${apiRoot}/alert`, alertRoutes);

  // Location routes
  app.use(`${apiRoot}/location`, expressRateLimiter); // 30 req/min
  app.use(`${apiRoot}/location`, addRedisClientMiddleware(redisClient));
  app.use(`${apiRoot}/location`, locationRoutes);

  // SMS routes
  app.use(`${apiRoot}/sms`, expressRateLimiter); // 30 req/min
  app.use(`${apiRoot}/sms`, addRedisClientMiddleware(redisClient));
  app.use(`${apiRoot}/sms`, smsRoutes);

  // USSD routes
  app.use(`${apiRoot}/ussd`, expressRateLimiter); // 30 req/min
  app.use(`${apiRoot}/ussd`, addRedisClientMiddleware(redisClient));
  app.use(`${apiRoot}/ussd`, ussdRoutes);

  //404 handler
  app.use(notFoundMiddleware);

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

    // Initialise RabbitMQ Service
    await initializeRabbitMQConnection();
    logger.info("Successfully initialised RabbitMQ Service");

    // Configure Express server
    const app = configureServer(redisClient);

    // Start server
    const server = app
      .listen(serverConfig.app.port, () => {
        logger.info(`GeoAlert Service has started at http://${serverConfig.cors.localhost}:${serverConfig.app.port}`);
      })
      .on("error", (error) => {
        logger.fatal(`Error while starting the server on port ${serverConfig.app.port}`, {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
        exitWithMessage(`Server startup failed: ${error.message}`);
      });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info("HTTP server closed");

        try {
          // Close Redis connection
          await redisClient.quit();
          logger.info("Redis connection closed");

          // Close Prisma connection
          await prisma.$disconnect();
          logger.info("Database connection closed");

          process.exit(0);
        } catch (error) {
          logger.error("Error during graceful shutdown", { error });
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    // Register shutdown handlers
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
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
};

setupProcessErrorHandlers();
startServer();
