import path from "path";
import fs from "fs";
import statusCodes from "http-status";
import { AppError } from "./error.util.js";
import winston, { addColors, createLogger, format, transports } from "winston";
import type { LogLevel } from "../types/var.types.js";

// memory for log directory creation
let logDirMem: string | null = null;

export const createDir = (dirPath: string) => {
  if (logDirMem) return logDirMem;
  
  const absolutePath = path.join(process.cwd(), dirPath);

  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(absolutePath, { recursive: true });
      logDirMem = absolutePath;
      return absolutePath;
    } catch (error) {
      const errObj = error as Error;
      const err = new AppError({
        name: `LogDirCreationError-${errObj.name}`,
        message: `Unable to create log directory, ${errObj.message}`,
        statusCode: statusCodes.INTERNAL_SERVER_ERROR,
        handler: "createDirUtil",
        isOperational: true,
      });
      throw err;
    }
  }
  logDirMem = absolutePath;
  return absolutePath;
};

const logDir = createDir("logs");
const appName = "geo-alert";

const logLevels: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  verbose: 4,
  debug: 5,
};

const logColors: Record<LogLevel, string> = {
  fatal: "red bold",
  error: "red",
  warn: "yellow",
  info: "green",
  verbose: "cyan",
  debug: "blue",
};

// console format for database seed operations
const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss"}),
  format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Only include metadata in development or when explicitly needed
    if (process.env.NODE_ENV === "development" && Object.keys(meta).length) {
      log += ` ${JSON.stringify(meta, null, 0)}`; // Compact JSON
    }
    
    if (stack && process.env.NODE_ENV === "development") {
      log += `\n${stack}`;
    }
    return log;
  })
);

// Batch format for high-volume operations
const batchFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.simple()
);

// File format
const fileFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.errors({ stack: true }),
  format.json()
);

class Logger {
  private logger: winston.Logger;
  private batchLogger: winston.Logger;
  private lastProgressTime: number = 0;
  private progressThrottleMs: number = 1000; // Throttle progress updates to 1 second

  constructor() {
    addColors(logColors);

    const errorFileTransport = new transports.File({
      filename: path.join(logDir, `${appName}-error.log`),
      level: "error",
      handleExceptions: true,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: fileFormat,
    });

    const combinedFileTransport = new transports.File({
      filename: path.join(logDir, `${appName}-combined.log`),
      handleExceptions: true,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: fileFormat,
    });

    const consoleTransport = new transports.Console({
      format: consoleFormat,
      handleExceptions: true,
    });

    // Main logger for normal operations
    this.logger = createLogger({
      level: process.env.NODE_ENV === "development" ? "debug" : "info",
      levels: logLevels,
      exitOnError: false,
      transports:
        process.env.NODE_ENV === "development"
          ? [consoleTransport, combinedFileTransport]
          : [errorFileTransport, combinedFileTransport, consoleTransport],
    });

    // Dedicated logger for batch operations (file only, no console spam)
    this.batchLogger = createLogger({
      level: "info",
      levels: logLevels,
      exitOnError: false,
      transports: [
        new transports.File({
          filename: path.join(logDir, `${appName}-batch.log`),
          format: batchFormat,
          maxsize: 10485760, // 10MB for batch operations
          maxFiles: 10,
        }),
      ],
    });
  }

  public log(level: LogLevel, msg: string, meta?: Record<string, any>) {
    this.logger.log(level, msg, meta);
  }

  public debug(msg: string, meta?: Record<string, any>) {
    this.logger.debug(msg, meta);
  }

  public info(msg: string, meta?: Record<string, any>) {
    this.logger.info(msg, meta);
  }

  public warn(msg: string, meta?: Record<string, any>) {
    this.logger.warn(msg, meta);
  }

  public error(msg: string, meta?: Record<string, any>) {
    this.logger.error(msg, meta);
  }

  public fatal(msg: string, meta?: Record<string, any>) {
    this.logger.log("fatal", msg, meta);
  }

  // Batch-specific logging methods
  public batchInfo(msg: string, meta?: Record<string, any>) {
    this.batchLogger.info(msg, meta);
  }

  public batchError(msg: string, meta?: Record<string, any>) {
    this.batchLogger.error(msg, meta);
  }

  public batchWarn(msg: string, meta?: Record<string, any>) {
    this.batchLogger.warn(msg, meta);
  }

  public batchDebug(msg: string, meta?: Record<string, any>) {
    this.batchLogger.debug(msg, meta);
  }

  public batchFatal(msg: string, meta?: Record<string, any>) {
    this.batchLogger.log("fatal", msg, meta);
  }
  
  // Progress logging with throttling
  public progress(current: number, total: number, operation: string = "Processing") {
    const now = Date.now();
    if (now - this.lastProgressTime > this.progressThrottleMs) {
      const percentage = total > 0 ? ((current / total) * 100).toFixed(1) : "0.0";
      process.stdout.write(`\r${operation}: ${current}/${total} (${percentage}%)`);
      this.lastProgressTime = now;
    }
  }

  public progressComplete(message: string = "Complete") {
    process.stdout.write(`\r${message}\n`);
  }

  // for streaming logs e.g. to stream http logs with Morgan
  public stream = {
    write: (message: string) => {
      this.info(message.trim());
    },
  };
}

export const logger = new Logger();