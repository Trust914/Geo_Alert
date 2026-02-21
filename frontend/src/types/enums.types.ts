
// 1. UserRole
export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  COORDINATOR: 'COORDINATOR',
  OPERATOR: 'OPERATOR',
  VIEWER: 'VIEWER',
} as const;

// This line allows you to use 'UserRole' as a type in your code (e.g. user: UserRole)
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// 2. AlertStatus
export const AlertStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
} as const;

export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

// 3. AlertSeverity
export const AlertSeverity = {
  EXTREME: 'EXTREME',
  SEVERE: 'SEVERE',
  MODERATE: 'MODERATE',
  MINOR: 'MINOR',
} as const;

export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

export const AlertCategory = {
  GEO :'GEO',
  MET :'MET',
  SAFETY :'SAFETY',
  SECURITY :'SECURITY',
  RESCUE :'RESCUE',
  FIRE :'FIRE',
  HEALTH :'HEALTH',
  ENV :'ENV',
  TRANSPORT :'TRANSPORT',
  INFRA :'INFRA',
  CBRNE :'CBRNE',
  OTHER :'OTHER',
}
export type AlertCategory = (typeof AlertCategory)[keyof typeof AlertCategory];

// 4. AgencyStatus
export const AgencyStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export type AgencyStatus = (typeof AgencyStatus)[keyof typeof AgencyStatus];

export const AgencyType = {
  FEDERAL : 'FEDERAL',
  STATE : 'STATE',
  LOCAL : 'LOCAL',
  SECURITY : 'SECURITY',
  HEALTH : 'HEALTH',
  EMERGENCY : 'EMERGENCY',
}
export type AgencyType = (typeof AgencyType)[keyof typeof AgencyType];

export const JurisdictionLevel = {
  NATIONAL : 'NATIONAL',
  STATE : 'STATE',
  LGA : 'LGA',
  WARD : 'WARD',
}
export type JurisdictionLevel = (typeof JurisdictionLevel)[keyof typeof JurisdictionLevel];

// 5. TwoFactorMethod
export const TwoFactorMethod = {
  NONE: 'NONE',
  EMAIL: 'EMAIL',
  GOOGLE_AUTHENTICATOR: 'GOOGLE_AUTHENTICATOR',
} as const;

export type TwoFactorMethod = (typeof TwoFactorMethod)[keyof typeof TwoFactorMethod];

// 6. TargetType
export const TargetType = {
  STATE: 'STATE',
  LGA: 'LGA',
  WARD: 'WARD',
  RADIUS: 'RADIUS',
  POLYGON: 'POLYGON',
  PATH: 'PATH',
} as const;

export type TargetType = (typeof TargetType)[keyof typeof TargetType];

export const DeliveryStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
};
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];