export const AgencyType = {
  FEDERAL: "FEDERAL",
  STATE: "STATE",
  LOCAL: "LOCAL",
  SECURITY: "SECURITY",
  HEALTH: "HEALTH",
  EMERGENCY: "EMERGENCY",
} as const;
export type AgencyType = (typeof AgencyType)[keyof typeof AgencyType];

export const JurisdictionLevel = {
  NATIONAL: "NATIONAL",
  STATE: "STATE",
  LGA: "LGA",
  WARD: "WARD",
} as const;
export type JurisdictionLevel = (typeof JurisdictionLevel)[keyof typeof JurisdictionLevel];

export const AgencyStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  INACTIVE: "INACTIVE",
} as const;
export type AgencyStatus = (typeof AgencyStatus)[keyof typeof AgencyStatus];

export interface IAgency {
  id: string;
  name: string;
  type: AgencyType;
  jurisdiction: string;
  jurisdictionLevel: JurisdictionLevel;
  contactEmail: string;
  contactPhone: string;
  status: AgencyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IAgencyAdmin {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mustChangePassword: boolean;
  requiresActivation: boolean;
  isActive: boolean;
}

export interface IAgencyWithAdmin extends IAgency {
  admin?: IAgencyAdmin;
  _count?: {
    users: number;
    alerts: number;
  };
}

export interface IAgencyOption {
  id: string;
  name: string;
  type: string;
  jurisdictionLevel: string;
}

export interface IAgencyUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  emailVerified: boolean;
}

export interface IAgencyDetailed extends IAgency {
  users: IAgencyUser[];
  _count: {
    users: number;
    alerts: number;
  };
}

export interface ICreateAgencyDTO {
  name: string;
  type: AgencyType;
  jurisdiction: string;
  jurisdictionLevel: JurisdictionLevel;
  contactEmail: string;
  contactPhone: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
}

export interface IUpdateAgencyDTO {
  name?: string;
  jurisdiction?: string;
  contactEmail?: string;
  contactPhone?: string;
  status?: AgencyStatus;
}

export interface IAgencyFilters {
  type?: AgencyType;
  jurisdictionLevel?: JurisdictionLevel;
  status?: AgencyStatus;
  search?: string;
  currentPage?: number;
  limit?: number;
}

export interface IAgencyStats {
  total: number;
  active: number;
  suspended: number;
  inactive: number;
  byType: Record<string, number>;
  byJurisdiction: Record<string, number>;
}

export interface IPagination {
  total: number;
  currentPage: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface IApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface IPaginatedApiResponse<T> extends IApiResponse<T[]> {
  pagination: IPagination;
}
