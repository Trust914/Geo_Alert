// src/features/users/services/user.services.ts
import { API_ENDPOINTS } from "../../../utils/constants";
import type { ICreateUserDTO, IUpdateUserDTO, IUserFilters, IUser } from "../types/";
import type { APIResponse } from "../../../types/common.types";
import { bffAxiosInstance } from "../../../lib/axios";

export class UserAPI {
  /**
   * Create a new user
   */
  static async createUser(data: ICreateUserDTO): Promise<IUser> {
    const response = await bffAxiosInstance.post<APIResponse<IUser>>(API_ENDPOINTS.USERS.CREATE, data);
    return response.data.data!;
  }

  /**
   * Get ALL users across all agencies (Super Admin only)
   */
  static async getAllUsers(filters?: IUserFilters): Promise<APIResponse<IUser[]>> {
    const params = new URLSearchParams();

    if (filters?.role) params.append("role", filters.role);
    if (filters?.isActive !== undefined) params.append("isActive", String(filters.isActive));
    if (filters?.search) params.append("search", filters.search);
    if (filters?.currentPage) params.append("currentPage", String(filters.currentPage));
    if (filters?.limit) params.append("limit", String(filters.limit));

    const response = await bffAxiosInstance.get<APIResponse<IUser[]>>(
      `${API_ENDPOINTS.USERS.LIST}?${params.toString()}`
    );
    return response.data!;
  }

  /**
   * Get users by agency (Agency Admin only)
   */
  static async getUsersByAgency(agencyId: string, filters?: IUserFilters): Promise<APIResponse<IUser[]>> {
    const params = new URLSearchParams();

    if (filters?.role) params.append("role", filters.role);
    if (filters?.isActive !== undefined) params.append("isActive", String(filters.isActive));
    if (filters?.search) params.append("search", filters.search);
    if (filters?.currentPage) params.append("currentPage", String(filters.currentPage));
    if (filters?.limit) params.append("limit", String(filters.limit));

    const response = await bffAxiosInstance.get<APIResponse<IUser[]>>(
      `${API_ENDPOINTS.USERS.BY_AGENCY(agencyId)}?${params.toString()}`
    );
    return response.data!;
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<IUser> {
    const response = await bffAxiosInstance.get<APIResponse<IUser>>(API_ENDPOINTS.USERS.BY_ID(userId));
    return response.data.data!;
  }

  /**
   * Update user
   */
  static async updateUser(userId: string, data: IUpdateUserDTO): Promise<IUser> {
    const response = await bffAxiosInstance.put<APIResponse<IUser>>(API_ENDPOINTS.USERS.UPDATE(userId), data);
    return response.data.data!;
  }

  /**
   * Deactivate user (requires 2FA)
   */
  static async deactivateUser(userId: string, twoFactorCode?: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (twoFactorCode) {
      headers["x-2fa-code"] = twoFactorCode;
    }
    await bffAxiosInstance.post(API_ENDPOINTS.USERS.DEACTIVATE(userId), {}, { headers });
  }

  /**
   * Reactivate user
   */
  static async reactivateUser(userId: string): Promise<void> {
    await bffAxiosInstance.post(API_ENDPOINTS.USERS.REACTIVATE(userId));
  }

  /**
   * Reset user password (requires 2FA)
   */
  static async resetUserPassword(userId: string, twoFactorCode?: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (twoFactorCode) {
      headers["x-2fa-code"] = twoFactorCode;
    }
    await bffAxiosInstance.post(API_ENDPOINTS.USERS.RESET_PASSWORD(userId), {}, { headers });
  }
}