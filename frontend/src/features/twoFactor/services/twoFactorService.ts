// import { axiosInstance } from "../../../lib/axios";
import { bffAxiosInstance } from "../../../lib/axios";
import type { APIResponse } from "../../../types/common.types";
import { API_ENDPOINTS } from "../../../utils/constants";
import type { TwoFactorStatus, TOTPSetupData, TOTPVerifyRequest, EmailSetupResponse, EmailVerifyRequest, BackupCodesData, Disable2FARequest } from "../types";

export const twoFactorService = {
  /**
   * 📊 Get 2FA status
   */
  async getStatus(): Promise<TwoFactorStatus> {
    const { data } = await bffAxiosInstance.get<APIResponse<TwoFactorStatus>>(API_ENDPOINTS.TWO_FACTOR.STATUS);
    return data.data!;
  },

  /**
   * 🔐 Setup TOTP (Google Authenticator)
   * Returns QR code and backup codes
   */
  async setupTOTP(): Promise<TOTPSetupData> {
    const { data } = await bffAxiosInstance.post<APIResponse<TOTPSetupData>>(API_ENDPOINTS.TWO_FACTOR.TOTP_SETUP);
    return data.data!;
  },

  /**
   * ✅ Verify and enable TOTP
   */
  async verifyTOTP(request: TOTPVerifyRequest): Promise<BackupCodesData> {
    const { data } = await bffAxiosInstance.post<APIResponse<BackupCodesData>>(API_ENDPOINTS.TWO_FACTOR.TOTP_VERIFY, request);
    return data.data!;
  },

  /**
   * 📧 Initiate Email 2FA setup
   * Sends verification code to email
   */
  async initiateEmailSetup(): Promise<EmailSetupResponse> {
    const { data } = await bffAxiosInstance.post<APIResponse<EmailSetupResponse>>(API_ENDPOINTS.TWO_FACTOR.EMAIL_SETUP);
    return data.data!;
  },

  /**
   * ✅ Verify email and enable Email 2FA
   */
  async verifyAndEnableEmail(request: EmailVerifyRequest): Promise<BackupCodesData> {
    const { data } = await bffAxiosInstance.post<APIResponse<BackupCodesData>>(API_ENDPOINTS.TWO_FACTOR.EMAIL_VERIFY, request);
    return data.data!;
  },

  /**
   * 📱 Request OTP (for sensitive actions like disable/regenerate)
   */
  async requestOTP(): Promise<void> {
    await bffAxiosInstance.post(API_ENDPOINTS.TWO_FACTOR.REQUEST_OTP);
  },

  async verifyPassword(password: string): Promise<void> {
    await bffAxiosInstance.post(API_ENDPOINTS.TWO_FACTOR.VERIFY_PASSWORD, { password });
  },

  /**
   * Regenerate backup codes (Requires OTP)
   * Invalidates old codes
   */
  async regenerateBackupCodes(code?: string): Promise<BackupCodesData> {
    const headers: Record<string, string> = {};
    if (code) {
      headers["x-2fa-code"] = code;
    }

    const { data } = await bffAxiosInstance.post<APIResponse<BackupCodesData>>(API_ENDPOINTS.TWO_FACTOR.REGENERATE_CODES, {}, { headers });
    return data.data!;
  },

  /**
   * ❌ Disable 2FA (Requires Password + OTP)
   */
  async disable2FA(request: Disable2FARequest, code?: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (code) {
      headers["x-2fa-code"] = code;
    }

    await bffAxiosInstance.post(API_ENDPOINTS.TWO_FACTOR.DISABLE, request, { headers });
  },
};
