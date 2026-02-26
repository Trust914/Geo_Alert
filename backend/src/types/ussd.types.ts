// export interface USSDSession {
//   sessionId: string;
//   phoneNumber: string;
//   step: string;
//   data: Record<string, any>;
// }
import { Language, USSDStep } from "../prisma/prisma/generated/enums.js";

// --- 1. Webhook Input DTO (Strictly typed input) ---
export interface IUSSDWebhookPayload {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text: string;
  networkCode?: string;
}

// --- 2. Session Data Structure ---
export interface USSDSession {
  sessionId: string;
  phoneNumber: string;
  step: USSDStep; // Use the Enum instead of generic string
  data: {
    // Define known keys for better type safety, allow extension
    isRegistered?: boolean;
    isUpdate?: boolean;
    language?: Language;
    firstName?: string;
    lastName?: string;
    stateId?: string;
    stateName?: string;
    lgaId?: string;
    lgaName?: string;
    wardId?: string | null;
    wardName?: string;
    currentPage?: number;
    [key: string]: any; // Allow dynamic data
  };
}
