import type { AgencyType, AgencyStatus, JurisdictionLevel, UserRole, TwoFactorMethod } from "../prisma/prisma/generated/enums.js";
import type { IApiResponse, IPaginatedApiResponse, IPaginationMeta } from "./api.response.js";
import type { IPagination, ISortOptions } from "./common.types.js";

export interface IUser {
  id: string;
  email: string;
  passwordHash: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  agencyId: string;
  mustChangePassword: boolean;
  emailVerified: boolean;
  isTwoFactorEnabled: boolean;
  twoFactorMethod: TwoFactorMethod | null;
  twoFactorSecret: string | null;
  twoFactorBackupCodes: string[] | null;
  agency: {
    id: string;
    name: string;
    type: AgencyType;
    jurisdictionLevel: JurisdictionLevel;
    status: AgencyStatus;
  };
  lastLoginAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  agencyId: string;
  mustChangePassword: boolean;
  emailVerified: boolean;
  isTwoFactorEnabled: boolean;
  twoFactorMethod: TwoFactorMethod | null;
  lastLoginAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Relations (Optional)
  agency?: {
    id: string;
    name: string;
    type: AgencyType;
    jurisdictionLevel: JurisdictionLevel;
    status: AgencyStatus;
  };
  requiresActivation: boolean;
}

export interface ICreateUserDTO {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  agencyId?: string;
}

export interface IUpdateUserDTO {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface IUserFilters {
  role?: UserRole;
  isActive?: boolean | undefined;
  search?: string;
  pagination: IPagination;
  sortOptions: ISortOptions;
  // currentPage?: number;
  // limit?: number;
}

export interface IAgencyListResponse {
  data: ISafeUser[];
  pagination: IPaginationMeta;
}

// --- 2. Response Contracts ---

// Single User (Create, GetById, Update)
export type TUserResponse = IApiResponse<ISafeUser>;

// List Users
export type TUserListResponse = IPaginatedApiResponse<ISafeUser>;

// Generic Actions (Deactivate, Reactivate, Reset Password)
export type TUserMessageResponse = IApiResponse<null>;
