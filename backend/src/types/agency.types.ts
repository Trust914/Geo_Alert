import type { AgencyStatus, AgencyType, JurisdictionLevel } from "../prisma/prisma/generated/enums.js";
import type { IApiResponse, IPaginatedApiResponse, IPaginationMeta } from "./api.response.js";
import type { IPagination, ISortOptions } from "./common.types.js";

export interface IAgency {
  id: string;
  name: string;
  type: AgencyType;
  jurisdiction: string;
  jurisdictionLevel: JurisdictionLevel;
  contactEmail: string;
  contactPhone: string;
  status: AgencyStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateAgencyDTO {
  name: string;
  createdById: string;
  type: AgencyType;
  jurisdiction: string;
  jurisdictionLevel: JurisdictionLevel;
  contactEmail: string;
  contactPhone: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone: string;
}

export interface IUpdateAgencyDTO {
  name?: string;
  jurisdiction?: string;
  contactEmail?: string;
  contactPhone?: string;
  status?: AgencyStatus;
}

export interface IAgencyResponse {
  id: string;
  name: string;
  type: AgencyType;
  jurisdiction: string;
  jurisdictionLevel: JurisdictionLevel;
  contactEmail: string;
  contactPhone: string;
  status: AgencyStatus;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    users: number;
    alerts: number;
  };
}

export interface IAgencyWithAdmin extends IAgencyResponse {
  admin?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    mustChangePassword: boolean;
    // temporaryPassword: string;
    requiresActivation: boolean;
  };
}

export interface IAgencyFilters {
  type?: AgencyType;
  jurisdictionLevel?: JurisdictionLevel;
  status?: AgencyStatus;
  search?: string;
  pagination: IPagination;
  sortOptions: ISortOptions
}

// --- Data Shapes (What the Service Returns) ---

export interface IAgencyStats {
  total: number;
  active: number;
  suspended: number;
  inactive: number;
  byType: Record<string, number>;
  byJurisdiction: Record<string, number>;
}

// --- Frontend Response Types (The "Contracts") ---

// 1. Create: Returns the Agency + Full Admin info
export type TCreateAgencyResponse = IApiResponse<IAgencyWithAdmin>;

// 2. Get All: Returns an Array + Pagination

export interface TGetAgenciesResponse extends IPaginatedApiResponse<IAgencyWithAdmin> {
  data: IAgencyWithAdmin[];
  pagination: IPaginationMeta;
}
// 3. Get One / Update / Reactivate: Returns single Agency
export type TAgencyResponse = IApiResponse<IAgencyWithAdmin>;

// 4. Delete: Returns nothing (null)
export type TDeleteAgencyResponse = IApiResponse<IAgencyWithAdmin>;

// 5. Stats: Returns the stats object
export type TAgencyStatsResponse = IApiResponse<IAgencyStats>;
