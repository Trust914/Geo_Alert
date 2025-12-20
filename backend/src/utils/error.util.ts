import type { IAppError, IAppErrorParams } from "../types/interfaces.types.js";

export class AppError extends Error implements IAppError {
  public readonly statusCode: number;
  public readonly handler: string;
  public readonly isOperational: boolean;
  public readonly details: Record<string, any>;
  public readonly cause?: unknown;

  constructor(params: IAppErrorParams) {
    super(params.message, { cause: params.cause });
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = params.name || "AppError";
    this.statusCode = params.statusCode;
    this.handler = params.handler || "AppError";
    this.isOperational = params.isOperational ?? true;
    this.details = params.details || {};
    this.cause = params.cause;

    // Capture stack trace only if it wasn't already captured by super
    if (!this.stack) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static unauthorized(
    message = "Unauthorized access",
    handler = "AuthHandler"
  ) {
    return new AppError({
      name: "UnauthorizedError",
      message,
      statusCode: 401,
      handler,
      isOperational: true,
    });
  }

  static forbidden(message = "Access forbidden", handler = "AuthHandler") {
    return new AppError({
      name: "ForbiddenError",
      message,
      statusCode: 403,
      handler,
      isOperational: true,
    });
  }

  static notFound(message = "Resource not found", handler = "NotFoundHandler") {
    return new AppError({
      name: "NotFoundError",
      message,
      statusCode: 404,
      handler,
      isOperational: true,
    });
  }

  static internal(
    message = "Internal Server Error",
    cause?: unknown,
    handler = "SystemHandler"
  ) {
    return new AppError({
      name: "InternalServerError",
      message,
      statusCode: 500,
      handler,
      isOperational: false, 
      cause,
    });
  }
}
