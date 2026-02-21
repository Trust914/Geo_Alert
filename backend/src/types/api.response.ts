/**
 * Global Standard API Response
 */
export interface IApiResponse<T = any> {
  success: boolean; // Always true for 2xx, false for 4xx/5xx
  message: string; // Human-readable message (e.g. "User created")
  data?: T; // The actual payload (optional, because errors don't have data)
  error?: {
    // Only present if success is false
    code: number; // e.g. 400, 401, 500
    details?:
      | Array<{ field: string; message: string }> // For Zod/Validation errors
      | Record<string, any>; // For Logic flags (e.g., requires2FA, error codes)
  };
}

/**
 * Pagination Metadata Structure
 */
export interface IPaginationMeta {
  total: number;
  currentPage: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  skip?: number;
}

/**
 * Standard Paginated Response
 * Merges the standard response with pagination metadata
 */
export interface IPaginatedApiResponse<T> extends IApiResponse<T[]> {
  pagination: IPaginationMeta;
}
