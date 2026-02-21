const bffBase = "/bff";

export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: "auth/login",
    LOGOUT: "auth/logout",
    LOGOUT_ALL: "auth/logout-all",
    REFRESH: "auth/refresh",
    ME: "auth/me",
    CHANGE_PASSWORD: "auth/change-password",
    TWO_FA_VERIFY: "auth/two-factor/verify-login",
    TWO_FA_RESEND: "auth/two-factor/resend",
    SESSIONS: "auth/sessions",
    REVOKE_SESSION: (sessionId: string) => `auth/sessions/${sessionId}`,
    RESET_PASSWORD_VERIFY: "auth/reset-password/verify",
    RESET_PASSWORD_COMPLETE: "auth/reset-password/complete",
  },

  BFF_ENDPOINTS: {
    // Authentication
    LOGIN: `${bffBase}/login`,
    VERIFY_2FA: `${bffBase}/verify-2fa`,
    RESEND_OTP: `${bffBase}/resend-otp`,
    ME: `${bffBase}/me`,
    REFRESH: `${bffBase}/refresh`,
    LOGOUT: `${bffBase}/logout`,
    LOGOUT_ALL: `${bffBase}/logout-all`,
    CHANGE_PASSWORD: `${bffBase}/change-password`,

    // Password Reset
    RESET_PASSWORD_VERIFY: `${bffBase}/reset-password/verify`,
    RESET_PASSWORD_COMPLETE: `${bffBase}/reset-password/complete`,
    RESET_PASSWORD_RESEND_OTP: `${bffBase}/reset-password/resend-otp`,

    // Session Management
    SESSION_STATUS: `${bffBase}/session/status`,
    SESSIONS: `${bffBase}/sessions`,
    REVOKE_SESSION: (sessionId: string) => `${bffBase}/sessions/${sessionId}`,

    // Audit Logs
    AUDIT_LOGS: `${bffBase}/audit-logs`,
    AGENCY_AUDIT_LOGS: `${bffBase}/audit-logs/agency`,
  },

  ACTIVATION: {
    VERIFY: "activation/verify",
    COMPLETE: "activation/complete",
    RESEND: "activation/resend",
  },

  TWO_FACTOR: {
    STATUS: "two-factor/status",
    TOTP_SETUP: "two-factor/totp/setup",
    TOTP_VERIFY: "two-factor/totp/verify",
    EMAIL_SETUP: "two-factor/email/initiate-setup",
    EMAIL_VERIFY: "two-factor/email/verify-and-enable",
    REQUEST_OTP: "two-factor/request-otp",
    VERIFY_PASSWORD: "two-factor/verify-password",
    REGENERATE_CODES: "/two-factor/backup-codes/regenerate",
    DISABLE: "two-factor/disable",
  },

  // Agencies
  AGENCIES: {
    BASE: "agency",
    BY_ID: (id: string) => `agency/${id}`,
    STATS: "agency/stats",
    REACTIVATE: (id: string) => `agency/${id}/reactivate`,
    LIST: "/agency", // GET - all agencies
  },

  // Alerts
  ALERTS: {
    BASE: "alert",
    BY_ID: (alertId: string) => `alert/${alertId}`,
    PREVIEW: (alertId: string) => `alert/${alertId}/preview`,
    SEND: (alertId: string) => `alert/${alertId}/send`,
    CANCEL: (alertId: string) => `alert/${alertId}/cancel`,
    STATS: (alertId: string) => `alert/${alertId}/stats`,
    ESTIMATE: "alert/estimate-recipients",
  },

  // Citizens
  CITIZENS: {
    BASE: "citizens",
    REGISTER: "citizens/register",
    BY_ID: (id: string) => `citizens/${id}`,
    BY_PHONE: (phone: string) => `citizens/phone/${phone}`,
    STATS: "citizens/statistics",
    NEARBY: "citizens/nearby",
    OPT_IN: (phone: string) => `citizens/${phone}/opt-in`,
    OPT_OUT: (phone: string) => `citizens/${phone}/opt-out`,
  },

  // Locations
  LOCATIONS: {
    STATES: "location/states",
    LGAS: (stateId: string) => `location/states/${stateId}/lgas`,
    WARDS: (lgaId: string) => `location/lgas/${lgaId}/wards`,
  },

  // Users
  USERS: {
    CREATE: "user/create",
    BY_ID: (id: string) => `user/${id}`,
    UPDATE: (id: string) => `user/${id}/update`,
    DEACTIVATE: (id: string) => `user/${id}/deactivate`,
    REACTIVATE: (id: string) => `user/${id}/reactivate`,
    RESET_PASSWORD: (id: string) => `user/${id}/reset-password`,
    BY_AGENCY: (agencyId: string) => `/user/agency/${agencyId}`,
    LIST: "/user", 
  },

  // SMS
  SMS: {
    STATS: (alertId: string) => `sms/${alertId}/stats`,
    RETRY: (alertId: string) => `sms/${alertId}/retry`,
  },

  // Audit Logs
  AUDIT_LOGS: {
    USER: "auth/audit-logs",
    AGENCY: "auth/agency/audit-logs",
  },
} as const;
