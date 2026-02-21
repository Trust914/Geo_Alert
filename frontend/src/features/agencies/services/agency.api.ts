import { bffAxiosInstance } from "../../../lib/axios";
import type { APIResponse } from "../../../types";
import { API_ENDPOINTS } from "../../../utils";
import type { IAgencyWithAdmin, IAgencyDetailed, ICreateAgencyDTO, IUpdateAgencyDTO, IAgencyFilters, IAgencyStats, IApiResponse, IPaginatedApiResponse, IAgencyOption } from "../types/";

export const agencyApi = {
  /**
   * Create a new agency with an admin user
   */
  createAgency: async (data: ICreateAgencyDTO): Promise<IApiResponse<IAgencyWithAdmin>> => {
    const response = await bffAxiosInstance.post<IApiResponse<IAgencyWithAdmin>>(API_ENDPOINTS.AGENCIES.BASE, data);
    return response.data;
  },

  /**
   * Get list of all agencies (for super admin dropdowns)
   */
  getAllAgenciesDropDown: async (): Promise<IAgencyOption[]> => {
    const response = await bffAxiosInstance.get<APIResponse<IAgencyOption[]>>(API_ENDPOINTS.AGENCIES.LIST);
    return response.data.data!;
  },

  /**
   * Get all agencies with optional filters and pagination
   */
  getAllAgencies: async (filters?: IAgencyFilters): Promise<IPaginatedApiResponse<IAgencyWithAdmin>> => {
    const params = new URLSearchParams();

    if (filters?.type) params.append("type", filters.type);
    if (filters?.jurisdictionLevel) params.append("jurisdictionLevel", filters.jurisdictionLevel);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.currentPage) params.append("currentPage", filters.currentPage.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const response = await bffAxiosInstance.get<IPaginatedApiResponse<IAgencyWithAdmin>>(`${API_ENDPOINTS.AGENCIES.BASE}?${params.toString()}`);
    return response.data;
  },

  /**
   * Get a single agency by ID with detailed information
   */
  getAgencyById: async (id: string): Promise<IApiResponse<IAgencyDetailed>> => {
    const response = await bffAxiosInstance.get<IApiResponse<IAgencyDetailed>>(API_ENDPOINTS.AGENCIES.BY_ID(id));
    return response.data;
  },

  /**
   * Update agency information (requires 2FA)
   */
  updateAgency: async (id: string, data: IUpdateAgencyDTO, twoFactorCode?: string): Promise<IApiResponse<IAgencyWithAdmin>> => {
    const headers = twoFactorCode ? { "x-2fa-code": twoFactorCode } : undefined;

    const response = await bffAxiosInstance.put<IApiResponse<IAgencyWithAdmin>>(API_ENDPOINTS.AGENCIES.BY_ID(id), data, { headers });
    return response.data;
  },

  /**
   * Soft delete an agency (requires 2FA)
   */
  deleteAgency: async (id: string, twoFactorCode?: string): Promise<IApiResponse<IAgencyWithAdmin>> => {
    const headers = twoFactorCode ? { "X-2fa-code": twoFactorCode } : undefined;

    const response = await bffAxiosInstance.delete<IApiResponse<IAgencyWithAdmin>>(API_ENDPOINTS.AGENCIES.BY_ID(id), { headers });
    return response.data;
  },

  /**
   * Reactivate a deactivated agency
   */
  reactivateAgency: async (id: string): Promise<IApiResponse<IAgencyWithAdmin>> => {
    const response = await bffAxiosInstance.post<IApiResponse<IAgencyWithAdmin>>(API_ENDPOINTS.AGENCIES.REACTIVATE(id));
    return response.data;
  },

  /**
   * Get system-wide agency statistics
   */
  getAgencyStats: async (): Promise<IApiResponse<IAgencyStats>> => {
    const response = await bffAxiosInstance.get<IApiResponse<IAgencyStats>>(API_ENDPOINTS.AGENCIES.STATS);
    return response.data;
  },
};
