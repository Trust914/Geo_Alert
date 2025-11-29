export enum AgencyType {
  FEDERAL = 'FEDERAL',
  STATE = 'STATE',
  LOCAL = 'LOCAL',
  EMERGENCY = 'EMERGENCY',
  METEOROLOGICAL = 'METEOROLOGICAL',
  HEALTH = 'HEALTH',
  SECURITY = 'SECURITY',
}

export enum JurisdictionLevel {
  NATIONAL = 'NATIONAL',
  STATE = 'STATE',
  LGA = 'LGA',
  WARD = 'WARD',
}

export enum AgencyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum AlertCategory {
  WEATHER = 'WEATHER',
  HEALTH = 'HEALTH',
  SECURITY = 'SECURITY',
  DISASTER = 'DISASTER',
  TRAFFIC = 'TRAFFIC',
  PUBLIC_SAFETY = 'PUBLIC_SAFETY',
}

export enum Severity {
  EXTREME = 'EXTREME',
  SEVERE = 'SEVERE',
  MODERATE = 'MODERATE',
  MINOR = 'MINOR',
}

export enum Urgency {
  IMMEDIATE = 'IMMEDIATE',
  EXPECTED = 'EXPECTED',
  FUTURE = 'FUTURE',
}

export enum AlertStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  SENT = 'SENT',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum TargetType {
  STATE = 'STATE',
  LGA = 'LGA',
  WARD = 'WARD',
  RADIUS = 'RADIUS',
  POLYGON = 'POLYGON',
  PATH = 'PATH',
}

export enum DeliveryStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum ActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  SEND_ALERT = 'SEND_ALERT',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  AGENCY_ADMIN = 'AGENCY_ADMIN',
  OPERATOR = 'OPERATOR',
  VIEWER = 'VIEWER',
}

export enum Language {
  ENGLISH = 'ENGLISH',
  HAUSA = 'HAUSA',
  YORUBA = 'YORUBA',
  IGBO = 'IGBO',
}