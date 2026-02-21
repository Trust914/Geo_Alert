import type { IApiResponse } from "../types/api.response.js";

export const AccountType = {
  USER: "USER",
  AGENCY_ADMIN: "AGENCY_ADMIN",
} as const;

export type TAccountType = (typeof AccountType)[keyof typeof AccountType];

// --- Request DTOs (Inputs) ---
export interface IActivationEmailData {
  userId: string;
  email: string;
  firstName: string;
  accountType: TAccountType;
  metadata?: {
    agencyName?: string;
    role?: string;
    creatorName?: string;
    agencyType?: string;
    jurisdiction?: string;
  };
}

// --- Service Internal Results ---
export interface IActivationTokenResult {
  valid: boolean;
  email: string;
  accountType: TAccountType;
}

// --- Frontend Response Types (Outputs) ---

/**
 * Data returned when verifying a token (GET /verify)
 */
export interface IActivationVerifyData {
  email: string;
  accountType: TAccountType;
}

/**
 * The full response types for the Frontend to use
 */
export type TVerifyActivationResponse = IApiResponse<IActivationVerifyData>;
export type TCompleteActivationResponse = IApiResponse<null>; // No data returned, just success message
export type TResendActivationResponse = IApiResponse<null>;
