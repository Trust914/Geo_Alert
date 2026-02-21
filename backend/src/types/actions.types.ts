import { ActionType } from "../prisma/prisma/generated/enums.js";

export const ACTION_DESCRIPTIONS: Record<ActionType, string> = {
  // Authentication
  [ActionType.LOGIN_PENDING_2FA]: "Login pending 2FA verification",
  [ActionType.LOGIN_SUCCESS]: "Successful login",
  [ActionType.LOGIN_FAILED]: "Failed login attempt",
  [ActionType.LOGOUT]: "User logged out",
  [ActionType.LOGOUT_ALL]: "Logged out from all devices",
  [ActionType.TOKEN_REFRESH]: "Access token refreshed",
  [ActionType.SESSION_REVOKED]: "Session revoked",

  // Password
  [ActionType.PASSWORD_CHANGE]: "Password changed",
  [ActionType.PASSWORD_CHANGE_FAILED]: "Failed password change",
  [ActionType.PASSWORD_RESET]: "Password reset by admin",

  // User Management
  [ActionType.USER_CREATED]: "User created",
  [ActionType.USER_UPDATED]: "User updated",
  [ActionType.USER_DELETED]: "User deleted",
  [ActionType.USER_ACTIVATED]: "User activated",
  [ActionType.USER_DEACTIVATED]: "User deactivated",

  // Agency
  [ActionType.AGENCY_CREATED]: "Agency created",
  [ActionType.AGENCY_UPDATED]: "Agency updated",
  [ActionType.AGENCY_DELETED]: "Agency deleted",
  [ActionType.AGENCY_ACTIVATED]: "Agency activated",
  [ActionType.AGENCY_SUSPENDED]: "Agency suspended",

  // Alert
  [ActionType.ALERT_CREATED]: "Alert created",
  [ActionType.ALERT_UPDATED]: "Alert updated",
  [ActionType.ALERT_SENT]: "Alert sent",
  [ActionType.ALERT_CANCELLED]: "Alert cancelled",
  [ActionType.ALERT_EXPIRED]: "Alert expired",
  [ActionType.ALERT_VIEWED]: "Alert viewed",
  [ActionType.ALERT_FAILED]: "Alert failed",

  // Citizen
  [ActionType.CITIZEN_REGISTERED]: "Citizen registered",
  [ActionType.CITIZEN_UPDATED]: "Citizen updated",
  [ActionType.CITIZEN_OPTED_IN]: "Citizen opted in",
  [ActionType.CITIZEN_OPTED_OUT]: "Citizen opted out",
  [ActionType.CITIZEN_DELETED]: "Citizen deleted",

  // System
  [ActionType.SYSTEM_CONFIG_CHANGED]: "System configuration changed",
  [ActionType.BACKUP_CREATED]: "Backup created",
  [ActionType.BACKUP_RESTORED]: "Backup restored",

  // Security
  [ActionType.SUSPICIOUS_ACTIVITY]: "Suspicious activity detected",
  [ActionType.SECURITY_ALERT]: "Security Alert",
  [ActionType.UNAUTHORIZED_ACCESS_ATTEMPT]: "Unauthorized access attempt",
  [ActionType.DATA_EXPORT]: "Data exported",
  [ActionType.DATA_IMPORT]: "Data imported",

  // 2FA Setup
  [ActionType.TWO_FA_SETUP_INITIATED]: "2FA setup initiated",
  [ActionType.TWO_FA_SETUP_FAILED]: "2FA setup failed",
  [ActionType.TWO_FA_ENABLED]: "Two-factor authentication enabled",
  [ActionType.TWO_FA_DISABLED]: "Two-factor authentication disabled",

  // 2FA Verification
  [ActionType.TWO_FA_VERIFICATION_SUCCESS]: "2FA verification successful",
  [ActionType.TWO_FA_VERIFICATION_FAILED]: "2FA verification failed",

  // Email OTP
  [ActionType.EMAIL_OTP_SENT]: "Email OTP sent",

  // Backup Codes
  [ActionType.BACKUP_CODE_USED]: "Backup code used for login",
  [ActionType.BACKUP_CODES_REGENERATED]: "Backup codes regenerated",

  // Account Activation
  [ActionType.ACTIVATION_EMAIL_SENT]: "Activation email sent",
  [ActionType.ACCOUNT_ACTIVATED]: "Account activated successfully",
  [ActionType.ACTIVATION_FAILED]: "Account activation failed",

  // Other
  [ActionType.OTHER]: "Other action",
};
