import type { TwoFactorMethod } from "../../../types/enums.types";

export interface TwoFactorStatus {
  enabled: boolean;
  method: TwoFactorMethod;
  hasBackupCodes: boolean;
  backupCodesRemaining?: number;
}

export interface TOTPSetupData {
  secret: string;
  qrCodeUrl: string;
  otpAuthUrl: string;
  backupCodes: string[];
}

export interface TOTPVerifyRequest {
  token: string;
}

export interface EmailSetupResponse {
  message: string;
  expiresInMinutes: number;
}

export interface EmailVerifyRequest {
  code: string;
}

export interface BackupCodesData {
  backupCodes: string[];
}

export interface Disable2FARequest {
  password: string;
}