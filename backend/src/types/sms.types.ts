import type { DeliveryStatus } from "../prisma/prisma/generated/enums";
import type { IApiResponse } from "./api.response";

export interface SendSMSOptions {
  to: string | string[]; // Phone number(s) in format: +234XXXXXXXXXX
  message: string;
  from?: string; // Sender ID
  enqueue?: boolean; // Queue for bulk sending
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  phoneNumber: string;
  status: DeliveryStatus;
  networkCode: string;
  cost?: string;
  error?: string;
}

// Interface for incoming webhook data
export interface ATDeliveryReport {
  id: string; // This corresponds to 'gatewayMessageId' in  DB
  status: DeliveryStatus;
  phoneNumber: string;
  networkCode: string;
  failureReason: string;
  retryCount: Number;
}

export interface ISMSDeliveryStatsData {
  total: number;
  delivered: number;
  failed: number;
  pending: number; // Combined queued + sent
  sent: number;
  queued: number;
  deliveryRate: number; // Percentage 0-100
  failureRate: number; // Percentage 0-100
  averageDeliveryTime?: number | undefined; // Seconds
}

export interface ISMSRetryResultData {
  retriedCount: number;
  skippedCount: number;
  maxRetriesReached: number;
}

// --- NEW: Response Contracts ---

// Stats Response
export type TSMSStatsResponse = IApiResponse<ISMSDeliveryStatsData>;

// Retry Action Response
export type TSMSRetryResponse = IApiResponse<ISMSRetryResultData>;
