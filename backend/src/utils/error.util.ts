import type { IAppError, IAppErrorParams } from "../types/interfaces.types";

export class AppError extends Error implements IAppError {
  statusCode: number;
  handler: string;
  isOperational: boolean;
  details: Record<string, any>;
  cause?: Error | unknown;

  constructor(params: IAppErrorParams) {
    super(params.message, { cause: params.cause });
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = params.name;
    this.message = params.message;
    this.statusCode = params.statusCode;
    this.handler = params.handler;
    this.isOperational = params.isOperational;
    this.details = params.details || {};
    this.cause = params.cause;

    Error.captureStackTrace(this);
  }
}
