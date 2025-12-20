import type { LineString, MultiPolygon, Point, Polygon } from "geojson";
import {
  ActionType,
  AgencyStatus,
  AgencyType,
  AlertCategory,
  AlertStatus,
  DeliveryStatus,
  JurisdictionLevel,
  Language,
  Severity,
  TargetType,
  Urgency,
  UserRole,
  UserType,
} from "./enums.js";
import type { Jwt, JwtPayload } from "jsonwebtoken";

export interface IGeoConfig {
  tableName: string;
  nameField: string;
  parentField?: string;
  parentNameField?: string;
  getStateCode?: (stateName: string) => string;
}

export interface IAppError extends Error {
  name: string;
  message: string;
  statusCode: number;
  handler: string;
  isOperational: boolean;
  details: Record<string, any>;
  cause?: Error | unknown;
}

export interface IAppErrorParams {
  name: string;
  message: string;
  statusCode: number;
  handler: string;
  isOperational: boolean;
  details?: Record<string, any>;
  cause?: Error | unknown;
}

export interface IAgency {
  _id: string;
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

export interface IUser {
  _id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  agencyId: string;
  lastLoginAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IState {
  _id: string;
  name: string;
  stateCode: string;
  population: number | null;
  boundary: MultiPolygon | null;
  centroid: Point | null;
  areaKm2: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILGA {
  _id: string;
  name: string;
  stateId: string;
  population: number | null;
  boundary: MultiPolygon | null;
  centroid: Point | null;
  areaKm2: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWard {
  _id: string;
  name: string;
  lgaId: string;
  population: number | null;
  boundary: MultiPolygon | null;
  centroid: Point | null;
  areaKm2: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICitizen {
  _id: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  stateId: string;
  lgaId: string;
  wardId: string | null;
  location: Point | null;
  preferredLanguage: Language;
  isOptedIn: boolean;
  registeredAt: Date;
  updatedAt: Date;
}

export interface IAlert {
  _id: string;
  agencyId: string;
  createdByUserId: string;
  category: AlertCategory;
  severity: Severity;
  urgency: Urgency;
  headline: string;
  description: string;
  instruction: string | null;
  capXml: string;
  status: AlertStatus;
  affectedArea: MultiPolygon | null;
  incidentLocation: Point | null;
  createdAt: Date;
  sentAt: Date | null;
  expiresAt: Date | null;
  updatedAt: Date;
}

export interface IAlertTarget {
  _id: string;
  alertId: string;
  targetType: TargetType;
  stateId: string | null;
  lgaId: string | null;
  wardId: string | null;
  radiusMeters: number | null;
  centerPoint: Point | null;
  targetPolygon: Polygon | null;
  targetPath: LineString | null;
  pathBufferMeters: number | null;
  estimatedRecipients: number | null;
  createdAt: Date;
}

export interface IDeliveredAlert {
  _id: string;
  alertId: string;
  citizenId: string;
  phoneNumber: string;
  status: DeliveryStatus;
  queuedAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failureReason: string | null;
  retryCount: number;
  gatewayMessageId: string | null;
  updatedAt: Date;
}

export interface IAuditLog {
  _id: string;
  userId: string | null;
  action: ActionType;
  entityType: string;
  entityId: string;
  changes: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
}

// RELATIONS

export interface AgencyWithRelations extends IAgency {
  users?: IUser[];
  alerts?: IAlert[];
}

export interface UserWithRelations extends IUser {
  agency?: IAgency;
  alerts?: IAlert[];
  auditLogs?: IAuditLog[];
}

export interface StateWithRelations extends IState {
  lgas?: ILGA[];
  citizens?: ICitizen[];
  alertTargets?: IAlertTarget[];
}

export interface LGAWithRelations extends ILGA {
  state?: IState;
  wards?: IWard[];
  citizens?: ICitizen[];
  alertTargets?: IAlertTarget[];
}

export interface WardWithRelations extends IWard {
  lga?: ILGA;
  citizens?: ICitizen[];
  alertTargets?: IAlertTarget[];
}

export interface CitizenWithRelations extends ICitizen {
  state?: IState;
  lga?: ILGA;
  ward?: IWard | null;
  deliveries?: IDeliveredAlert[];
}

export interface AlertWithRelations extends IAlert {
  agency?: IAgency;
  createdBy?: IUser;
  targets?: IAlertTarget[];
  deliveries?: IDeliveredAlert[];
}

export interface AlertTargetWithRelations extends IAlertTarget {
  alert?: IAlert;
  state?: IState | null;
  lga?: ILGA | null;
  ward?: IWard | null;
}

export interface DeliveredAlertWithRelations extends IDeliveredAlert {
  alert?: IAlert;
  citizen?: ICitizen;
}

export interface AuditLogWithRelations extends IAuditLog {
  user?: IUser | null;
}

export interface IJWTPayload extends JwtPayload {
  userId: string;     
  type: UserType;       // AGENCY or PUBLIC
  agencyId?: string;    
  role?: UserRole;   // SUPER_ADMIN, AGENCY_ADMIN,OPERARTOR, VIEWER
}