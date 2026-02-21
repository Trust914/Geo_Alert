import type { InputJsonObject, JsonValue } from "@prisma/client/runtime/client.js";
import type { JwtPayload } from "jsonwebtoken";
import type { ActionType, EntityType, TwoFactorMethod, UserRole } from "../prisma/prisma/generated/enums.js";
import type { IApiResponse, IPaginatedApiResponse, IPaginationMeta } from "./api.response.js";
import type { ISafeUser } from "./user.types.js";
import type { IPagination } from "./common.types.js";

export interface IJWTPayload extends JwtPayload {
  userId: string;
  agencyId?: string;
  role?: UserRole;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    agencyId: string;
    mustChangePassword: boolean;
    isTwoFactorEnabled: boolean;
    twoFactorMethod: TwoFactorMethod;
    agency?: {
      id: string;
      name: string;
      type: string;
      jurisdictionLevel: string;
    };
  };
  accessToken?: string;
  refreshToken?: string;

  // 2FA-specific fields (when 2FA is required)
  requiresTwoFactor?: boolean;
  twoFactorMethod?: TwoFactorMethod;
  preAuthToken?: string;
}

export interface IEmailOptions {
  to: string | string[];
  emailContent: {
    subject: string;
    html: string;
  };
}

export interface IEmailJob {
  to: string;
  subject: string;
  html: string;
}

export interface AuthFilters {
  action?: ActionType;
  entityType?: EntityType;
  userId?: string;
  agencyId?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  pagination: IPagination;
}

export interface IAuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  agencyId: string;
  mustChangePassword: boolean;
  isTwoFactorEnabled: boolean;
  twoFactorMethod?: TwoFactorMethod;
  agency?: {
    id: string;
    name: string;
    type: string;
    jurisdictionLevel: string;
  };
}

export interface ILoginSuccessData {
  user: IAuthUser;
  accessToken: string;
}

export interface ILogin2FARequiredData {
  requiresTwoFactor: true; // Literal type for discrimination
  twoFactorMethod: TwoFactorMethod;
  preAuthToken: string;
  user: Pick<IAuthUser, "id" | "email" | "firstName" | "lastName">; // Minimal user info
}

export interface IRefreshTokenData {
  accessToken: string;
}

export interface IAuditLogData {
  id: string;
  action: ActionType;
  entityType: EntityType;
  entityId: string;
  description: string;
  changes: any;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
  userId: string | null;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
  };
}

export interface ISessionData {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  isRevoked: boolean;
}

// --- Response Contracts (The "Promise" to Frontend) ---

// Login can return EITHER Success OR 2FA Required
// We use a Union Type so frontend checks `requiresTwoFactor` boolean
export type TLoginResponse = IApiResponse<ILoginSuccessData | ILogin2FARequiredData>;

// Verify 2FA -> Same as Login Success
export type TVerify2FAResponse = IApiResponse<ILoginSuccessData>;

// Refresh Token
export type TRefreshTokenResponse = IApiResponse<IRefreshTokenData>;

// Get Current User
export type TCurrentUserResponse = IApiResponse<{ user: IAuthUser | ISafeUser }>;

// Audit Logs (Paginated)
export type TAuditLogResponse = IPaginatedApiResponse<IAuditLogData>;

// Sessions
export type TGetSessionsResponse = IApiResponse<{ sessions: ISessionData[] }>;

// Generic Messages (Logout, Password Change, etc.)
export type TAuthMessageResponse = IApiResponse<null>;
export interface IAgencyAudiLogsResponse extends IPaginatedApiResponse<TAuditLogResponse> {
  data: TAuditLogResponse[];
}
