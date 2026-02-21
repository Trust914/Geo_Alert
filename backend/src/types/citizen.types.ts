import type { Point } from "geojson";
import type { Language } from "../prisma/prisma/generated/enums.js";
import type { IPagination } from "./common.types.js";
import type { IApiResponse, IPaginatedApiResponse } from "./api.response.js";

export interface ICitizen {
  id: string;
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

export interface RegisterCitizenDTO {
  phoneNumber: string;
  firstName: string;
  lastName: string;
  stateId: string;
  lgaId: string;
  wardId?: string;
  preferredLanguage?: Language;
  location?: { latitude: number; longitude: number };
}

export interface UpdateCitizenDTO {
  firstName?: string;
  lastName?: string;
  stateId?: string;
  lgaId?: string;
  wardId?: string;
  preferredLanguage?: Language;
  location?: { latitude: number; longitude: number };
  isOptedIn?: boolean;
}

export interface CitizenFilters {
  stateId?: string;
  lgaId?: string;
  wardId?: string;
  isOptedIn?: boolean;
  search?: string;
  pagination: IPagination
}

// --- 1. Safe Data Shapes (What the frontend receives) ---

/**
 * Standard Citizen Data
 */
export interface ICitizenData {
  id: string;
  phoneNumber: string; // Masked or normalized if needed
  firstName: string;
  lastName: string;
  preferredLanguage: Language;
  isOptedIn: boolean;
  registeredAt: Date;
  updatedAt: Date;

  // Relations (Always included in service methods)
  state: { id: string; name: string };
  lga: { id: string; name: string };
  ward?: { id: string; name: string } | null;

  // Location is optional because it might not be set or relevant for lists
  location?: Point | null;
}

/**
 * Citizen Data for "Nearby" endpoint (Includes Distance)
 */
export interface ICitizenNearbyData extends Omit<ICitizenData, "state" | "lga" | "ward" | "updatedAt" | "registeredAt"> {
  distanceMeters: number;
}

/**
 * Statistics Data
 */
export interface ICitizenStats {
  total: number;
  optedIn: number;
  optedOut: number;
  byState: Record<string, number>; // Map State ID/Name to count
  byLanguage: Record<string, number>;
}

// --- 2. Response Contracts ---



// Single Citizen
export type TCitizenResponse = IApiResponse<ICitizenData>;

// Paginated List
export type TCitizenListResponse = IPaginatedApiResponse<ICitizenData>;

// Nearby List (Not paginated usually, but an array)
export type TCitizenNearbyResponse = IApiResponse<ICitizenNearbyData[]>;

// Statistics
export type TCitizenStatsResponse = IApiResponse<ICitizenStats>;

// Generic Message (Opt-in/Opt-out)
export type TCitizenMessageResponse = IApiResponse<null>;
