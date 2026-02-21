import type { SessionData } from "react-router-dom";
import { bffAxiosInstance } from "../../../lib/axios";
import type { APIResponse } from "../../../types/common.types";
import { API_ENDPOINTS } from "../../../utils/constants";
import type { ActivateAccountRequest, ChangePasswordRequest, CurrentUserResponse, LoginCredentials, LoginResponse, RefreshTokenResponse, ResetPasswordRequest, TwoFactorVerifyRequest, TwoFactorVerifyResponse } from "../types";

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const { data } = await bffAxiosInstance.post<APIResponse<LoginResponse>>(API_ENDPOINTS.AUTH.LOGIN, credentials);
    return data.data!;
  },

  async verify2FA(
    request: TwoFactorVerifyRequest,
    tempToken?: string
  ): Promise<TwoFactorVerifyResponse> {
    // If we have a tempToken, send it as the Authorization header
    const config = tempToken ? { headers: { Authorization: `Bearer ${tempToken}` } } : {};

    const { data } = await bffAxiosInstance.post<APIResponse<TwoFactorVerifyResponse>>(
      API_ENDPOINTS.AUTH.TWO_FA_VERIFY,
      request,
      config
    );
    return data.data!;
  },

  async resend2FA(): Promise<void> {
    await bffAxiosInstance.post(API_ENDPOINTS.AUTH.TWO_FA_RESEND);
  },

  async getCurrentUser(): Promise<CurrentUserResponse> {
    const { data } = await bffAxiosInstance.get<APIResponse<CurrentUserResponse>>(API_ENDPOINTS.AUTH.ME);
    return data.data!;
  },

  async logout(): Promise<void> {
    await bffAxiosInstance.post(API_ENDPOINTS.AUTH.LOGOUT);
  },

  async logoutAll(): Promise<void> {
    await bffAxiosInstance.post(API_ENDPOINTS.AUTH.LOGOUT_ALL);
  },

  async changePassword(request: ChangePasswordRequest): Promise<void> {
    await bffAxiosInstance.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, request);
  },

  async refreshToken(): Promise<RefreshTokenResponse> {
    const { data } = await bffAxiosInstance.post<APIResponse<RefreshTokenResponse>>(API_ENDPOINTS.AUTH.REFRESH);
    return data.data!;
  },

  async getSessions(): Promise<SessionData[]> {
    const { data } = await bffAxiosInstance.get<APIResponse<SessionData[]>>(API_ENDPOINTS.AUTH.SESSIONS);
    return data.data!;
  },

  async revokeSession(sessionId: string): Promise<void> {
    await bffAxiosInstance.delete(API_ENDPOINTS.AUTH.REVOKE_SESSION(sessionId));
  },

  async activateAccount(request: ActivateAccountRequest): Promise<void> {
    await bffAxiosInstance.post(API_ENDPOINTS.ACTIVATION.COMPLETE, request);
  },

  async verifyActivationToken(
    userId: string,
    token: string
  ): Promise<{
    valid: boolean;
    requiresTwoFactor: boolean;
    twoFactorMethod?: string;
  }> {
    const { data } = await bffAxiosInstance.get(API_ENDPOINTS.ACTIVATION.VERIFY, {
      params: { userId, token },
    });
    return data.data!;
  },

  async resendActivationEmail(userId: string): Promise<void> {
    await bffAxiosInstance.post(API_ENDPOINTS.ACTIVATION.RESEND, { userId });
  },

  async verifyResetToken(
    userId: string,
    token: string
  ): Promise<{
    valid: boolean;
    requiresTwoFactor: boolean;
    twoFactorMethod?: string;
  }> {
    const { data } = await bffAxiosInstance.get(API_ENDPOINTS.AUTH.RESET_PASSWORD_VERIFY, {
      params: { userId, token },
    });
    return data.data!;
  },

  async completePasswordReset(request: ResetPasswordRequest): Promise<void> {
    await bffAxiosInstance.post(API_ENDPOINTS.AUTH.RESET_PASSWORD_COMPLETE, request);
  },
};
