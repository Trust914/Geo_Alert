import type { InputJsonObject } from "@prisma/client/runtime/client";
import type { ActionType, EntityType } from "../prisma/prisma/generated/enums";
import { int } from "zod";

export interface IAppError extends Error {
  name: string;
  message: string;
  statusCode: number;
  handler: string;
  isOperational: boolean;
  details: Record<string, any>;
  cause?: Error | unknown;
}

export interface IAppErrorParams {
  name: string;
  message: string;
  statusCode: number;
  handler: string;
  isOperational: boolean;
  details?: Record<string, any>;
  cause?: Error | unknown;
}

export interface IAuditLogData {
  userId: string | null;
  action: ActionType;
  entityType: EntityType;
  entityId: string;
  changes?: InputJsonObject;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp?: Date;
}

export interface IPagination {
  currentPage: number;
  limit: number;
  skip: number;
}

export interface ISortOptions {
  sortBy: Record<string, 'asc' | 'desc'>;
}