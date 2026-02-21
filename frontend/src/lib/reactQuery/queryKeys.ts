import type { AlertFilters } from "../../features/alerts/types/alert.types";
import type { IUserFilters } from "../../features/users/types";
import type { IAgencyFilters } from "../../features/agencies/types";
import type { AuditLogFilters } from "../../features/bff_auth/types";

const ALERT_ROOT = ["alerts"] as const;
const AGENCY_ROOT = ["agencies", "all"] as const;
const BFF_ROOT = ["bff"] as const;

export const QUERY_KEYS = {
  AUTH: {
    ME: ["auth", "me"] as const,
    SESSIONS: ["auth", "sessions"] as const,
    AUDIT_LOGS: ["auth", "audit-logs"] as const,
  },
  TWO_FACTOR: {
    STATUS: ["2fa", "status"] as const,
  },
  BFF_AUTH: {
    // Authentication
    ME: [...BFF_ROOT, "me"] as const,

    // Session Management
    SESSION_STATUS: [...BFF_ROOT, "session", "status"] as const,
    SESSIONS: [...BFF_ROOT, "sessions"] as const,
    SESSION_BY_ID: (sessionId: string) => [...BFF_ROOT, "sessions", sessionId] as const,

    // Audit Logs
    AUDIT_LOGS: (filters?: AuditLogFilters) => [...BFF_ROOT, "audit-logs", filters] as const,
    AGENCY_AUDIT_LOGS: (filters?: AuditLogFilters) => [...BFF_ROOT, "audit-logs", "agency", filters] as const,

    // Password Reset
    VERIFY_RESET_TOKEN: (userId: string, token: string) => [...BFF_ROOT, "reset-password", "verify", userId, token] as const,
  },
  AGENCIES: {
    ALL: AGENCY_ROOT,
    LIST: (filters?: IAgencyFilters) => [...AGENCY_ROOT, "list", filters] as const,
    BY_ID: (id: string) => [...AGENCY_ROOT, "detail", id] as const,
    STATS: [...AGENCY_ROOT, "stats"] as const,
  },
  ALERTS: {
    ALL: ALERT_ROOT,
    LIST: (filters?: AlertFilters) => [...ALERT_ROOT, "list", filters] as const,
    BY_ID: (id: string) => [...ALERT_ROOT, "detail", id] as const,
    STATS: (id: string) => [...ALERT_ROOT, "stats", id] as const,
    PREVIEW: (id: string) => [...ALERT_ROOT, "preview", id] as const,
  },
  CITIZENS: {
    ALL: ["citizens"] as const,
    BY_ID: (id: string) => ["citizens", id] as const,
    STATS: ["citizens", "stats"] as const,
  },
  LOCATIONS: {
    STATES: ["locations", "states"] as const,
    LGAS: (stateId: string) => ["locations", "lgas", stateId] as const,
    WARDS: (lgaId: string) => ["locations", "wards", lgaId] as const,
  },
  USERS: {
    // ALL: ["users"] as const,
    ALL: (filters?: IUserFilters) => ['users', 'all', filters] as const,
    BY_ID: (id: string) => ["users", id] as const,
    BY_AGENCY: (agencyId: string, filters?: IUserFilters) => ["users", "agency", "filters", agencyId, filters] as const,
  },
  SMS: {
    STATS: (alertId: string) => ["sms", "stats", alertId] as const,
  },
};
