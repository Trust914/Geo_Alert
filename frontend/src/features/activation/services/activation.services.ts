import { bffAxiosInstance } from "../../../lib/axios";
import { API_ENDPOINTS } from "../../../utils/constants";
import type {
  CompleteActivationRequest,
  CompleteActivationResponse,
  ResendActivationRequest,
  ResendActivationResponse,
  VerifyTokenRequest,
  VerifyTokenResponse,
} from "../types/";

export const activationService = {
  /**
   * Verify activation token from email link
   */
  verifyToken: async (params: VerifyTokenRequest): Promise<VerifyTokenResponse> => {
    const response = await bffAxiosInstance.get<VerifyTokenResponse>(API_ENDPOINTS.ACTIVATION.VERIFY, {
      params: {
        token: params.token,
        userId: params.userId,
      },
    });
    return response.data;
  },

  /**
   * Complete account activation with password
   */
  completeActivation: async (data: CompleteActivationRequest): Promise<CompleteActivationResponse> => {
    const response = await bffAxiosInstance.post<CompleteActivationResponse>(API_ENDPOINTS.ACTIVATION.COMPLETE, data);
    return response.data;
  },

  /**
   * Resend activation email
   */
  resendActivationEmail: async (data: ResendActivationRequest): Promise<ResendActivationResponse> => {
    const response = await bffAxiosInstance.post<ResendActivationResponse>(API_ENDPOINTS.ACTIVATION.RESEND, data);
    return response.data;
  },
};