import type { Feature, Geometry, LineString, Point, Polygon } from "geojson";
import {
  ActionType,
  EntityType,
  type AlertCategory,
  type AlertCertainty,
  type AlertScope,
  type AlertStatus,
  type DeliveryStatus,
  type MessageType,
  type Severity,
  type TargetType,
  type Urgency,
} from "../prisma/prisma/generated/enums.js";
import type { IApiResponse, IPaginatedApiResponse } from "./api.response.js";
import type { IPaginationMeta } from "./api.response.js";
import type { IPagination, ISortOptions } from "./common.types.js";

export interface IAlertData {
  id: string;
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
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  sentAt: Date | null;

  cancelReason?: string | null;
  cancelledAt?: Date | null;
  cancelledByUserId?: string | null;

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

  // Relations (Optional because lists might not need full details)
  agency?: {
    id: string;
    name: string;
    type: string;
  };
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  targets?: IAlertTargetData[];
  metrics?: {
    deliveriesCount: number;
  };
}

export interface IAlertTargetData {
  id: string;
  targetType: TargetType;
  estimatedRecipients: number | null;
  // Localized names for display
  locationName?: string;
  radiusMeters?: number | null;
}
export type CoordinatePair = [lng: number, lat: number];

export interface IGeoJSONPoint {
  type: "Point";
  coordinates: CoordinatePair; // [longitude, latitude]
}

export interface IGeoJSONPolygon {
  type: "Polygon";
  coordinates: CoordinatePair[][][]; // [[[lng, lat], [lng, lat], ...]]
}

export interface IGeoJSONLineString {
  type: "LineString";
  coordinates: CoordinatePair[]; // [[lng, lat], [lng, lat], ...]
}

export type IGeoJSONGeometry = IGeoJSONPoint | IGeoJSONPolygon | IGeoJSONLineString;

// export interface IAlertTarget {
//   id: string;
//   alertId: string;
//   targetType: TargetType;
//   stateId: string | null;
//   lgaId: string | null;
//   wardId: string | null;
//   radiusMeters: number | null;
//   centerPoint: Point | null;
//   targetPolygon: Polygon | null;
//   targetPath: LineString | null;
//   pathBufferMeters: number | null;
//   estimatedRecipients: number | null;
//   createdAt: Date;
// }

export type IAlertTarget = {
  targetType: TargetType;
  locationName?: string;

  // Unified geometry field for all map-based targets
  geometry?: IGeoJSONGeometry;

  // For radius specifically (if needed separately)
  radius?: number;

  // For PATH specifically
  bufferMeters?: number;

  // For admin area targets
  stateId?: string;
  lgaId?: string;
  wardId?: string;
};

// export type IAlertTarget =
//   // 1. Admin Areas
//   | {
//       targetType: typeof TargetType.STATE | typeof TargetType.LGA | typeof TargetType.WARD;
//       stateId?: string;
//       lgaId?: string;
//       wardId?: string;
//       locationName?: string;
//     }
//   // 2. Radius (Flat) - Used by frontend forms often
//   | {
//       targetType: typeof TargetType.RADIUS;
//       latitude: number;
//       longitude: number;
//       radius: number;
//       locationName?: string;
//       centerPoint?: never; // Ensure mutual exclusivity if needed
//     }
//   // 3. Radius (Nested) - Used by some backend DTOs/validators
//   | {
//       targetType: typeof TargetType.RADIUS;
//       centerPoint: { latitude: number; longitude: number };
//       radius: number;
//       locationName?: string;
//       latitude?: never;
//       longitude?: never;
//     }
//   // 4. Polygon / Path (Custom Geometry)
//   | {
//       targetType: typeof TargetType.POLYGON | typeof TargetType.PATH;
//       // GeoJSON style array of coordinates: [[lng, lat], [lng, lat], ...]
//       coordinates: CoordinatePair[];
//       locationName?: string;
//       bufferMeters?: number; // Specific to PATH
//     };

export interface IRecipientEstimateData {
  estimatedRecipients: number;
}

export interface IDeliveredAlert {
  id: string;
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

export interface ICreateAlertDTO {
  agencyId: string;
  createdByUserId: string;
  category: AlertCategory;
  severity: Severity;
  urgency: Urgency;
  headline: string;
  description: string;
  instruction: string;
  expiresAt: Date;
  incidentLocation?: {
    latitude: number;
    longitude: number;
  };
  targets: IAlertTarget[];
}

export interface IAlertFilters {
  category?: AlertCategory;
  severity?: Severity;
  status?: AlertStatus;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  pagination: IPagination;
  sortOptions: ISortOptions;
}

// export interface IAlertPreview {
//   alert: {
//     id: string;
//     category: AlertCategory;
//     severity: Severity;
//     urgency: Urgency;
//     headline: string;
//     description: string;
//     instruction?: string;
//     status: AlertStatus;
//     expiresAt?: Date;
//   };
//   agency: {
//     id: string;
//     name: string;
//     type: string;
//   };
//   createdBy: {
//     firstName: string;
//     lastName: string;
//     email: string;
//   };
//   targets: Array<{
//     id: string;
//     targetType: TargetType;
//     estimatedRecipients?: number;
//     locationname: string,
//     // state?: { name: string };
//     // lga?: { name: string };
//     // ward?: { name: string };
//   }>;
//   smsPreview: {
//     message: string;
//     characterCount: number;
//     messageCount: number;
//     estimatedCost: number;
//   };
//   deliveries: Array<{
//     id: string;
//     status: string;
//     queuedAt: Date;
//     sentAt?: Date;
//     deliveredAt?: Date;
//     failureReason?: string;
//   }>;
//   estimatedRecipients: number;
//   capXml: string;
// }

export interface IAlertStats {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: string;
}

export interface IAlertStatsData {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  successRate: number;
  failureRate: number;
}

export interface IDeliveryReport {
  alertId: string;
  totalRecipients: number;
  successful: number;
  failed: number;
  pending: number;
  deliveryRate: number;
  averageDeliveryTime?: number;
  failureReasons?: Array<{
    reason: string;
    count: number;
  }>;
}

export interface IGeoPoint {
  latitude: number;
  longitude: number;
}

export interface IGeoPolygon {
  coordinates: IGeoPoint[];
}

export interface IGeoPath {
  coordinates: IGeoPoint[];
}

export interface IAlertActivityLog {
  id: string;
  alertId: string;
  action: string;
  performedBy: {
    id: string;
    name: string;
    email: string;
  };
  timestamp: Date;
  details?: any;
}

export interface CAPAlertData {
  identifier: string;
  sender: string;
  sent: Date;
  status: AlertStatus;
  msgType: MessageType;
  scope: AlertScope;
  category: AlertCategory;
  event: string;
  urgency: Urgency;
  severity: Severity;
  certainty: AlertCertainty;
  headline: string;
  description: string;
  instruction: string;
  web?: string;
  contact?: string;
  areaDesc: string;
  polygon?: string;
  circle?: string;
}

export interface AlertJobData {
  action?: "PREPARE_RECIPIENTS" | "PROCESS_BATCH";
  alertId: string;
  userId: string;
  agencyId: string;
  // For batch processing
  batchStartId?: string;
  batchSize?: number;
}

export interface IAlertPreviewData {
  alert: {
    id: string;
    category: AlertCategory;
    severity: Severity;
    urgency: Urgency;
    headline: string;
    description: string;
    instruction: string;
    status: AlertStatus;
    expiresAt?: Date;
  };
  agency: {
    id: string;
    name: string;
    type: string;
  };
  createdBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
  targets: Array<{
    id: string;
    targetType: TargetType;
    estimatedRecipients: number;
    locationName: string; // Unified name (State/LGA/Ward)
  }>;
  deliveries: Array<{
    id: string;
    status: string;
    queuedAt: Date;
    sentAt?: Date;
    deliveredAt?: Date;
    failureReason?: string;
  }>;
  smsPreview: {
    message: string;
    characterCount: number;
    messageCount: number;
    estimatedCost: number;
  };
  capXml: string;

  estimatedRecipients: number;
}

// Response Contracts (The "Promise" to Frontend) ---

// Create/Update/GetById -> Single Alert
export type TAlertResponse = IApiResponse<IAlertData>;

// Get All -> Paginated List
export type TGetAlertsResponse = IPaginatedApiResponse<IAlertData>;

// Preview -> Complex Object
export type TAlertPreviewResponse = IApiResponse<IAlertPreviewData>;

// Stats -> Stats Object
export type TAlertStatsResponse = IApiResponse<IAlertStatsData>;

// Send/Cancel -> Alert Data + Message
export type TSendAlertResponse = IApiResponse<ISendAlertResponse>;

export interface ISendAlertResponse {
  status: AlertStatus;
  message: string;
  alert?: IAlertData;
  alertId: string;
}

export type TCancelAlertResponse = IApiResponse<IAlertData>;
// Estimate -> Just the number
export type TEstimateRecipientsResponse = IApiResponse<IRecipientEstimateData>;
