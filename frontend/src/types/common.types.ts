import type { InternalAxiosRequestConfig } from "axios";
import type { TwoFactorMethod } from "./enums.types";

export interface IPagination {
  currentPage: number;
  limit: number;
  skip: number;
}

export interface IPaginationMeta extends IPagination {
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// export interface ApiResponse<T = unknown> {
//   success: boolean;
//   message: string;
//   data?: T;
//   pagination?: IPaginationMeta;
// }
export interface APIResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  statusCode?: number;
  pagination?: IPaginationMeta;

  // details can be a validation array OR a logic object (like for 2FA)
  details?: Record<string, unknown> | Array<{ field: string; message: string }>;
}

export interface TwoFactorAuthError extends Error {
  is2FARequired: boolean;
  method?: TwoFactorMethod
  originalRequest?: InternalAxiosRequestConfig;
}

export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}
