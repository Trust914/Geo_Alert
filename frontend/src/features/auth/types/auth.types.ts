import type { TwoFactorMethod, UserRole } from "../../../types/enums.types";
import type { IAgency } from "../../agencies/types";
import type { ISafeUser } from "../../users/types";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  agencyId: string;
  isTwoFactorEnabled: boolean;
  twoFactorMethod?: TwoFactorMethod;
  mustChangePassword?: boolean;
  emailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date;
  agency?: IAgency

}

export interface LoginResponse {
  user: User;
  requiresTwoFactor: boolean;
  twoFactorMethod?: string;
  preAuthToken?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface TwoFactorVerifyRequest {
  code: string;
}

export interface TwoFactorVerifyResponse {
  user: User;
  accessToken: string;
}

export interface CurrentUserResponse {
  user: User;
  accessToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AuthContextType {
  user: User | ISafeUser |null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

export interface ActivateAccountRequest {
  userId: string;
  token: string;
  password: string;
}

export interface SessionData {
  id: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  expiresAt: Date;
  isRevoked: boolean;
}
export interface ResetPasswordRequest {
  token: string;
  userId: string;
  newPassword: string;
  totpCode?: string;
}

export interface VerificationResponse {
  valid: boolean;
  requiresTwoFactor: boolean;
  twoFactorMethod?: string;
}