import type { JurisdictionLevel } from "../prisma/prisma/generated/enums";

export enum EmailType {
  // Auth & Security
  TWO_FACTOR_SETUP = "2FA_SETUP",
  TWO_FACTOR_LOGIN = "2FA_LOGIN",
  TWO_FACTOR_ACTION = "2FA_ACTION",
  PASSWORD_RESET = "PASSWORD_RESET",

  // User Management
  USER_WELCOME = "USER_WELCOME",
  USER_INVITE = "USER_INVITE",

  // Agency Management
  AGENCY_WELCOME = "AGENCY_WELCOME",

  // Alerts
  ALERT_NOTIFICATION = "ALERT_NOTIFICATION",

  // Account Activation
   USER_ACTIVATION = "USER_ACTIVATION",
  AGENCY_ACTIVATION = "AGENCY_ACTIVATION",
}

export enum EmailPurpose{
  LOGIN = "LOGIN",
  SETUP = "SETUP",
  ACTION = "ACTION"
}

// Base interface for common data
export interface IBaseEmailData {
  appName: string;
}

// Specific Payloads
export interface ITwoFactorData extends IBaseEmailData {
  code: string;
  expiryMinutes?: number;
}

export interface IPasswordResetData extends IBaseEmailData {
  firstName: string;
  resetUrl?: string; // Optional if you use links
  temporaryPassword?: string; // Optional if you use temp passwords
  requestorIp?: string;
}

export interface IUserWelcomeData extends IBaseEmailData {
  firstName: string;
  lastName: string;
  agencyName: string;
  role: string;
  loginUrl: string;
  email: string;
  temporaryPassword?: string;
  creatorName?: string;
}

export interface IAgencyActivationData extends IBaseEmailData {
  adminName: string;
  agencyName: string;
  agencyType: string;
  jurisdiction: string;
  activationUrl: string;
  expiresInHours: number;
}

export interface IUserActivationData extends IBaseEmailData {
  firstName: string;
  agencyName: string;
  creatorName?: string;
  role: string;
  email: string;
  activationUrl: string;
  expiresInHours: number;
}

export interface IAgencyWelcomeData extends IBaseEmailData {
  adminName: string;
  agencyName: string;
  agencyType: string;
  jurisdiction: string;
  jurisdictionLevel: JurisdictionLevel;
  loginUrl: string;
  email: string;
  temporaryPassword?: string;
}

// Union type for the service
export type EmailTemplateData =
  | ITwoFactorData
  | IPasswordResetData
  | IUserWelcomeData
  | IAgencyWelcomeData;
