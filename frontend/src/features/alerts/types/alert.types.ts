export const AlertStatus = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
} as const;
export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

export const AlertSeverity = {
  EXTREME: "EXTREME",
  SEVERE: "SEVERE",
  MODERATE: "MODERATE",
  MINOR: "MINOR",
} as const;
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

// Updated to match documented API enums
export const AlertCategory = {
  GEO: 'GEOPHYSICAL',
  MET: 'METEOROLOGICAL',
  WEATHER: 'WEATHER',
  SAFETY: 'SAFETY',
  SECURITY: 'SECURITY',
  RESCUE: 'RESCUE',
  FIRE: 'FIRE',
  HEALTH: 'HEALTH',
  ENVIRONMENTAL: 'ENVIRONMENTAL',
  TRANSPORT: 'TRANSPORT',
  INFRASTRUCTURE: 'INFRASTRUCTURE',
  CBRNE: 'CBRNE',
  OTHER: 'OTHER'
} as const

export type AlertCategory = (typeof AlertCategory)[keyof typeof AlertCategory];

export const AlertUrgency = {
  IMMEDIATE: "IMMEDIATE",
  EXPECTED: "EXPECTED",
  FUTURE: "FUTURE",
  PAST: "PAST",
  UNKNOWN: "UNKNOWN",
} as const;
export type AlertUrgency = (typeof AlertUrgency)[keyof typeof AlertUrgency];

export const JurisdictionLevel = {
  NATIONAL: "NATIONAL",
  STATE: "STATE",
  LGA: "LGA",
  WARD: "WARD",
};
export type JurisdictionLevel = (typeof JurisdictionLevel)[keyof typeof JurisdictionLevel];

export const TargetType = {
  STATE: "STATE",
  LGA: "LGA",
  WARD: "WARD",
  RADIUS: "RADIUS",
  POLYGON: "POLYGON",
  PATH: "PATH",
} as const;
export type TargetType = (typeof TargetType)[keyof typeof TargetType];


export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface AdminArea {
  id: string;
  name: string;
  type: "STATE" | "LGA" | "WARD";
  parentId?: string; // e.g., State ID for an LGA
}
// Target Interfaces

export interface StateTarget {
  targetType: typeof TargetType.STATE;
  stateId: string;
  lgaId?: string;
  wardId?: string;
}

export interface LGATarget {
  targetType: typeof TargetType.LGA;
  stateId?: string;
  lgaId: string;
}

export interface WardTarget {
  targetType: typeof TargetType.WARD;
  wardId: string;
}

export interface RadiusTarget {
  targetType: typeof TargetType.RADIUS;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface PolygonTarget {
  targetType: typeof TargetType.POLYGON;
  coordinates: number[][];
}

export interface PathTarget {
  targetType: typeof TargetType.PATH;
  coordinates: number[][];
  radius: number; // Buffer distance (using 'radius' for consistency with backend naming patterns)
}

export interface AlertTarget {
  targetType: TargetType;

  // Administrative fields (for STATE, LGA, WARD)
  stateId?: string;
  lgaId?: string;
  wardId?: string;
  locationName?: string;

  // Geospatial fields (for RADIUS, POLYGON, PATH)
  latitude?: number;
  longitude?: number;
  radius?: number; // in meters or km depending on context
  radiusMeters?: number;
  bufferMeters?: number;
  geometry?: any; // GeoJSON Geometry
  coordinates?: number[][];
  center?: GeoPoint;
}

export interface AlertTargetWithDetails {
  id: string;
  targetType: TargetType;
  estimatedRecipients: number;
  locationName: string;
  state?: { name: string };
  lga?: { name: string };
  ward?: { name: string };
}

export interface Alert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  urgency: AlertUrgency;
  headline: string;
  description: string;
  instruction?: string;
  status: AlertStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdByUserId: string;
  capXml?: string;
  sentAt?: string;

  incidentLocation?: {
    latitude: number;
    longitude: number;
  };
  agency: {
    id: string;
    name: string;
    type?: string;
  };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  targets: AlertTargetWithDetails[];
  _count?: {
    deliveries: number;
  };
  cancelledBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;

   sentBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface AlertPreview {
  alert: Alert;
  targets: AlertTargetWithDetails[];
  agency: {
    id: string;
    name: string;
    type: string;
  };
  createdBy: {
    firstName: string;
    lastName: string;
  };
  smsPreview: {
    message: string;
    characterCount: number;
    messageCount: number;
    estimatedCost: number;
  };
  estimatedRecipients: number;
  deliveries: any[];
  capXml: string;
}

export interface AlertStatsData {
  totalRecipients: number;
  delivered: number;
  failed: number;
  pending: number;
  deliveryRate: number;
}

export interface AlertStatistics {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  successRate: number;
  failureRate: number;
}

// Filters
export interface AlertFilters {
  category?: AlertCategory;
  severity?: AlertSeverity;
  status?: AlertStatus;
  startDate?: string;
  endDate?: string;
  currentPage?: number;
  limit?: number;
  sortBy?: "createdAt" | "updatedAt" | "sentAt";
  sortOrder?: "asc" | "desc";
}


export interface CreateAlertRequest {
  headline: string;
  description: string;
  instruction?: string;
  category: AlertCategory;
  severity: AlertSeverity;
  urgency: AlertUrgency;
  expiresAt?: string | Date;
  targets: AlertTarget[];
}

export interface CreateAlertDTO {
  category: AlertCategory;
  severity: AlertSeverity;
  urgency: AlertUrgency;
  headline: string;
  description: string;
  instruction?: string;
  expiresAt?: string;
  incidentLocation?: {
    latitude: number;
    longitude: number;
  };
  targets: AlertTarget[];
}

export interface EstimateRecipientsRequest {
  targets: AlertTarget[];
}

export interface SendAlertRequest {
  code: string; // 2FA/OTP Code required by controller
}

export interface CancelAlertRequest {
  code: string; // 2FA/OTP Code required by controller
  reason?: string;
}

export interface SendAlertResponse {
  message: string;
  alertId?: string;
  status?: AlertStatus;
  alert?: Alert;
}


export interface CancelAlertResponse {
  message: string;
  alertId?: string;
  status?: AlertStatus;
  alert?: Alert;
}