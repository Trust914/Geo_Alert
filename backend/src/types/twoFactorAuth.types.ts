import { TwoFactorMethod } from "../prisma/prisma/generated/enums.js";
import type { IApiResponse } from "./api.response.js";

// --- 1. Safe Data Shapes ---

export interface ITOTPSetupData {
  secret: string;
  qrCodeUrl: string;
  otpAuthUrl: string;
  backupCodes: string[];
}

export interface IEmailSetupData {
  email: string;
  expiresInSeconds: number;
}

export interface IBackupCodesData {
  backupCodes: string[];
}

export interface I2FAStatusData {
  enabled: boolean;
  method: TwoFactorMethod;
  backupCodesCount: number;
}

// --- 2. Response Contracts ---

// Setup TOTP -> Returns Secret & QR
export type TTOTPSetupResponse = IApiResponse<ITOTPSetupData>;

// Initiate Email -> Returns Expiry info
export type TEmailSetupResponse = IApiResponse<IEmailSetupData>;

// Verify Email / Regenerate Codes -> Returns Backup Codes
export type TBackupCodesResponse = IApiResponse<IBackupCodesData>;

// Get Status -> Returns Status Object
export type T2FAStatusResponse = IApiResponse<I2FAStatusData>;

// Generic Success (Verify TOTP, Disable, Request OTP) -> No Data
export type T2FAGenericResponse = IApiResponse<null>;
