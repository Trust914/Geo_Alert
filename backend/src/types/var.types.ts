import type {
  AgencyStatus,
  AlertStatus,
  DeliveryStatus,
  Language,
} from "../prisma/prisma/generated/enums";
import type {
  IAgency,
  IAlert,
  IAlertTarget,
  IAuditLog,
  ICitizen,
  IDeliveredAlert,
  ILGA,
  IState,
  IUser,
  IWard,
} from "./interfaces.types";

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'verbose' | 'debug'


export type AgencyCreateInput = Omit<
  IAgency,
  "_id" | "createdAt" | "updatedAt" | "status"
> & {
  status?: AgencyStatus;
};

export type AgencyUpdateInput = Partial<
  Omit<IAgency, "_id" | "createdAt" | "updatedAt">
>;

export type UserCreateInput = Omit<
  IUser,
  "_id" | "createdAt" | "updatedAt" | "lastLoginAt" | "isActive"
> & {
  lastLoginAt?: Date | null;
  isActive?: boolean;
};

export type UserUpdateInput = Partial<
  Omit<IUser, "_id" | "createdAt" | "updatedAt">
>;

export type StateCreateInput = Omit<IState, "_id" | "createdAt" | "updatedAt">;

export type StateUpdateInput = Partial<
  Omit<IState, "_id" | "createdAt" | "updatedAt">
>;

export type LGACreateInput = Omit<ILGA, "_id" | "createdAt" | "updatedAt">;

export type LGAUpdateInput = Partial<
  Omit<ILGA, "_id" | "createdAt" | "updatedAt">
>;

export type WardCreateInput = Omit<IWard, "_id" | "createdAt" | "updatedAt">;

export type WardUpdateInput = Partial<
  Omit<IWard, "_id" | "createdAt" | "updatedAt">
>;

export type CitizenCreateInput = Omit<
  ICitizen,
  "_id" | "registeredAt" | "updatedAt" | "preferredLanguage" | "isOptedIn"
> & {
  preferredLanguage?: Language;
  isOptedIn?: boolean;
};

export type CitizenUpdateInput = Partial<
  Omit<ICitizen, "_id" | "registeredAt" | "updatedAt">
>;

export type AlertCreateInput = Omit<
  IAlert,
  "_id" | "createdAt" | "updatedAt" | "sentAt" | "status"
> & {
  status?: AlertStatus;
};

export type AlertUpdateInput = Partial<
  Omit<IAlert, "_id" | "createdAt" | "updatedAt">
>;

export type AlertTargetCreateInput = Omit<IAlertTarget, "_id" | "createdAt">;

export type AlertTargetUpdateInput = Partial<
  Omit<IAlertTarget, "_id" | "createdAt">
>;

export type DeliveredAlertCreateInput = Omit<
  IDeliveredAlert,
  "_id" | "queuedAt" | "updatedAt" | "status" | "retryCount"
> & {
  status?: DeliveryStatus;
  retryCount?: number;
};

export type DeliveredAlertUpdateInput = Partial<
  Omit<IDeliveredAlert, "_id" | "queuedAt" | "updatedAt">
>;

export type AuditLogCreateInput = Omit<IAuditLog, "_id" | "timestamp">;
