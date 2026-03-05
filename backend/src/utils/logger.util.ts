import fs from "fs";
import statusCodes from "http-status";
import path from "path";
import winston, { addColors, createLogger, format, transports } from "winston";

import { LogLevel } from "../prisma/prisma/generated/enums.js";
import { AppError } from "./error.util.js";
import { serverConfig } from "../config/server.config.js";

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
      throw new AppError({
        name: `LogDirCreationError-${errObj.name}`,
        message: `Unable to create log directory, ${errObj.message}`,
        statusCode: statusCodes.INTERNAL_SERVER_ERROR,
        handler: "createDirUtil",
        isOperational: true,
      });
    }
  }
  logDirMem = absolutePath;
  return absolutePath;
};

const logDir = createDir("logs");
const appName = "geo-alert";

const logLevels: Record<LogLevel, number> = {
  [LogLevel.fatal]: 0,
  [LogLevel.error]: 1,
  [LogLevel.warn]: 2,
  [LogLevel.info]: 3,
  [LogLevel.verbose]: 4,
  [LogLevel.debug]: 5,
};

const logColors: Record<LogLevel, string> = {
  [LogLevel.fatal]: "red bold",
  [LogLevel.error]: "red",
  [LogLevel.warn]: "yellow",
  [LogLevel.info]: "green",
  [LogLevel.verbose]: "cyan",
  [LogLevel.debug]: "blue",
};

const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (process.env.APP_ENV === "development" && Object.keys(meta).length) {
      log += ` ${JSON.stringify(meta, null, 0)}`;
    }
    if (stack && process.env.APP_ENV === "development") {
      log += `\n${stack}`;
    }
    return log;
  }),
);

const batchFormat = format.combine(format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), format.simple());

const fileFormat = format.combine(format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), format.errors({ stack: true }), format.json());

class Logger {
  private logger: winston.Logger;
  private batchLogger: winston.Logger;
  private lastProgressTime: number = 0;
  private progressThrottleMs: number = 1000;

  constructor() {
    addColors(logColors);

    const errorFileTransport = new transports.File({
      filename: path.join(logDir, `${appName}-error.log`),
      level: LogLevel.error,
      handleExceptions: true,
      maxsize: serverConfig.monitoring.maxLogFileSize,
      maxFiles: serverConfig.monitoring.maxLogFile,
      format: fileFormat,
    });

    const combinedFileTransport = new transports.File({
      filename: path.join(logDir, `${appName}-combined.log`),
      handleExceptions: true,
      maxsize: serverConfig.monitoring.maxLogFileSize,
      maxFiles: serverConfig.monitoring.maxLogFile,
      format: fileFormat,
    });

    const consoleTransport = new transports.Console({
      format: consoleFormat,
      handleExceptions: true,
    });

    this.logger = createLogger({
      level: process.env.APP_ENV === "development" ? LogLevel.debug : LogLevel.info,
      levels: logLevels,
      exitOnError: false,
      transports: process.env.APP_ENV === "development" ? [consoleTransport, combinedFileTransport] : [errorFileTransport, combinedFileTransport, consoleTransport],
    });

    this.batchLogger = createLogger({
      level: LogLevel.info,
      levels: logLevels,
      exitOnError: false,
      transports: [
        new transports.File({
          filename: path.join(logDir, `${appName}-batch.log`),
          format: batchFormat,
          maxsize: serverConfig.monitoring.maxLogFileSize,
          maxFiles: serverConfig.monitoring.maxLogFile,
        }),
      ],
    });
  }

  public log(level: LogLevel, msg: string, meta?: Record<string, any>) {
    this.logger.log(level, msg, meta);
  }

  public debug(msg: string, meta?: Record<string, any>) {
    this.logger.log(LogLevel.debug, msg, meta);
  }

  public info(msg: string, meta?: Record<string, any>) {
    this.logger.log(LogLevel.info, msg, meta);
  }

  public warn(msg: string, meta?: Record<string, any>) {
    this.logger.log(LogLevel.warn, msg, meta);
  }

  public error(msg: string, meta?: Record<string, any>) {
    this.logger.log(LogLevel.error, msg, meta);
  }

  public fatal(msg: string, meta?: Record<string, any>) {
    this.logger.log(LogLevel.fatal, msg, meta);
  }

  // Batch-specific logging methods
  public batchInfo(msg: string, meta?: Record<string, any>) {
    this.batchLogger.log(LogLevel.info, msg, meta);
  }

  public batchError(msg: string, meta?: Record<string, any>) {
    this.batchLogger.log(LogLevel.error, msg, meta);
  }

  public batchWarn(msg: string, meta?: Record<string, any>) {
    this.batchLogger.log(LogLevel.warn, msg, meta);
  }

  public batchDebug(msg: string, meta?: Record<string, any>) {
    this.batchLogger.log(LogLevel.debug, msg, meta);
  }

  public batchFatal(msg: string, meta?: Record<string, any>) {
    this.batchLogger.log(LogLevel.fatal, msg, meta);
  }

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

  public stream = {
    write: (message: string) => {
      this.info(message.trim());
    },
  };
}

export const logger = new Logger();
