import { bffAxiosInstance } from "../../../lib/axios";
import type { APIResponse } from "../../../types/";
import { API_ENDPOINTS } from "../../../utils/";
import type {
  Alert,
  AlertFilters,
  AlertPreview,
  AlertStatistics,
  CreateAlertRequest,
  EstimateRecipientsRequest,
  SendAlertResponse, // CRITICAL FIX: Import new type
  CancelAlertResponse, // CRITICAL FIX: Import new type
} from "../types/";

export const alertService = {
  /**
   * Get all alerts with optional filtering and pagination
   */
  getAlerts: async (filters?: AlertFilters): Promise<APIResponse<Alert[]>> => {
    const response = await bffAxiosInstance.get(API_ENDPOINTS.ALERTS.BASE, {
      params: filters,
    });

    // console.log("Fetched alerts with filters:", filters, "Response:", response.data);
    return response.data;
  },

  /**
   * Get a single alert by ID
   */
  getAlertById: async (id: string): Promise<APIResponse<Alert>> => {
    const response = await bffAxiosInstance.get(API_ENDPOINTS.ALERTS.BY_ID(id));
    return response.data;
  },

  /**
   * Create a new alert (Draft status)
   */
  createAlert: async (data: CreateAlertRequest): Promise<APIResponse<Alert>> => {
    // console.log("Creating alert with data:", data);
    const response = await bffAxiosInstance.post(API_ENDPOINTS.ALERTS.BASE, data);
    return response.data;
  },

  /**
   * Get SMS preview and cost estimation
   */
  previewAlert: async (id: string): Promise<APIResponse<AlertPreview>> => {
    const response = await bffAxiosInstance.get(API_ENDPOINTS.ALERTS.PREVIEW(id));
    return response.data;
  },

  initiateStepUpOTP: async (): Promise<APIResponse<{ message: string }>> => {
    const response = await bffAxiosInstance.post(
      API_ENDPOINTS.TWO_FACTOR.REQUEST_OTP, // -> "/api/v1/two-factor/request-otp"
    );
    return response.data;
  },

  /**
   * CRITICAL FIX: Updated return type to include optional 'alert' field
   * Send an alert
   * @param id - The Alert ID
   * @param code - The 2FA/OTP code entered by the user
   */
  sendAlert: async (id: string, code: string): Promise<APIResponse<SendAlertResponse>> => {
    const headers: Record<string, string> = {};
    if (code) {
      headers["x-2fa-code"] = code;
    }
    const response = await bffAxiosInstance.post(API_ENDPOINTS.ALERTS.SEND(id), { code }, { headers });
    return response.data;
  },

  /**
   * CRITICAL FIX: Updated return type to include optional 'alert' field
   * Cancel an active or queued alert
   * @param id - The Alert ID
   * @param code - The 2FA/OTP code entered by the user
   * @param reason - The reason for cancellation
   */
  cancelAlert: async (id: string, code: string, reason: string): Promise<APIResponse<CancelAlertResponse>> => {
    const headers: Record<string, string> = {};
    if (code) {
      headers["x-2fa-code"] = code;
    }
    const response = await bffAxiosInstance.post(
      API_ENDPOINTS.ALERTS.CANCEL(id),
      {
        code,
        reason,
      },
      { headers },
    );
    return response.data;
  },

  /**
   * Get delivery statistics for an alert
   */
  getAlertStatistics: async (id: string): Promise<APIResponse<AlertStatistics>> => {
    const response = await bffAxiosInstance.get(API_ENDPOINTS.ALERTS.STATS(id));
    return response.data;
  },

  /**
   * Estimate audience size before creating an alert
   */
  estimateRecipients: async (targets: EstimateRecipientsRequest["targets"]): Promise<APIResponse<{ estimatedRecipients: number }>> => {
    console.log("Targets:", targets);
    const response = await bffAxiosInstance.post(API_ENDPOINTS.ALERTS.ESTIMATE, { targets });
    console.log("Estimate Response:", response.data);
    return response.data;
  },
};
