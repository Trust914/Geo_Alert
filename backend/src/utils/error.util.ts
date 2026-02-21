import statusCodes from "http-status";
import type { IAppError, IAppErrorParams } from "../types/common.types.js";

export class AppError extends Error implements IAppError {
  public readonly statusCode: number;
  public readonly handler: string;
  public readonly isOperational: boolean;
  public readonly details: Record<string, any>;
  public readonly cause?: unknown;

  constructor(params: IAppErrorParams) {
    super(params.message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = params.name || "AppError";
    this.statusCode = params.statusCode;
    this.handler = params.handler || "AppError";
    this.isOperational = params.isOperational ?? true;
    this.details = params.details || {};
    this.cause = params.cause; // Stores the underlying error

    if (!this.stack) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message = "Bad Request", handler = "SystemHandler", details = {}) {
    return new AppError({
      name: "BadRequestError",
      message,
      statusCode: statusCodes.BAD_REQUEST,
      handler,
      isOperational: true,
      details,
    });
  }

  static conflict(message = "Resource conflict", handler = "SystemHandler", details = {}) {
    return new AppError({
      name: "ConflictError",
      message,
      statusCode: statusCodes.CONFLICT,
      handler,
      isOperational: true,
      details,
    });
  }

  static unauthorized(message = "Unauthorized access", handler = "AuthHandler", details = {}) {
    return new AppError({
      name: "UnauthorizedError",
      message,
      statusCode: statusCodes.UNAUTHORIZED,
      handler,
      isOperational: true,
      details,
    });
  }

  static forbidden(message = "Access forbidden", handler = "AuthHandler", details = {}) {
    return new AppError({
      name: "ForbiddenError",
      message,
      statusCode: statusCodes.FORBIDDEN,
      handler,
      isOperational: true,
      details,
    });
  }

  static notFound(message = "Resource not found", handler = "NotFoundHandler", details = {}) {
    return new AppError({
      name: "NotFoundError",
      message,
      statusCode: statusCodes.NOT_FOUND,
      handler,
      isOperational: true,
      details,
    });
  }

  static tooManyRequests(message = "Too many requests. Please try again later.", handler = "SystemHandler", details = {}) {
    return new AppError({
      name: "TooManyRequestsError",
      message,
      statusCode: statusCodes.TOO_MANY_REQUESTS,
      handler,
      isOperational: true,
      details,
    });
  }

  static internal(message = "Internal Server Error", cause?: unknown, handler = "SystemHandler", details = {}) {
    return new AppError({
      name: "InternalServerError",
      message,
      statusCode: statusCodes.INTERNAL_SERVER_ERROR,
      handler,
      isOperational: false, // Critical errors are not operational
      cause,
      details,
    });
  }

  static worker(message = "An error occurred in the SMS worker", handler = "WorkerHandler", details = {}) {
    return new AppError({
      name: "WorkerError",
      message,
      statusCode: statusCodes.INTERNAL_SERVER_ERROR,
      handler,
      isOperational: true,
      details,
    });
  }

  static precondition(message = "A required step must be done before proceeding", handler = "PreconditionHandler", details = {}) {
    return new AppError({
      name: "PreconditionError",
      message,
      statusCode: statusCodes.PRECONDITION_REQUIRED,
      handler,
      isOperational: true,
      details,
    });
  }
}
