/**
 * BFF Routes — Optimized with Token Refresh Support
 *
 * Key improvements:
 * 1. Added manual token refresh endpoint (optional)
 * 2. Enhanced session status endpoint
 * 3. Cleaner route organization and comments
 *
 * Middleware chain legend:
 *  bffAuthenticate                — validates session-ID cookie, attaches req.bffContext
 *                                   (now includes automatic token refresh)
 *  checkBFFPasswordChangeRequired — gates most routes if mustChangePassword is true
 *  requireBFFStepUp               — step-up 2FA via X-2FA-Code header
 *  paginationMiddleware           — parses page / limit query params
 *  validate(schema)               — request body validation
 */

import { Router } from "express";
import { BFFController } from "../controllers/bff.controller.js";
import { paginationMiddleware } from "../middlewares/additional.middleware.js";
import { bffAuthenticate, checkBFFPasswordChangeRequired, requireBFFStepUp } from "../middlewares/bff.middleware.js";
import { validate } from "../middlewares/validators.middleware.js";

// Reuse existing validators
import { changePasswordSchema, hardResetPasswordSchema, loginSchema } from "../validators/auth.validators.js";
import { verifyTokenSchema } from "../validators/activation.validators.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════
// PUBLIC ROUTES  (no authentication required)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/bff/auth/login
 *
 * Initial authentication step.
 *
 * Returns:
 *   200 + session cookie          — successful login (no 2FA)
 *   202 + temp-session cookie     — 2FA required
 */
router.post("/login", validate(loginSchema), BFFController.login);

/**
 * POST /api/v1/bff/auth/verify-2fa
 *
 * Complete 2FA verification during login.
 *
 * Requires: temp-session cookie (set by /auth/login)
 * Body:     { code: string }
 * Returns:  200 + final session cookie
 */
router.post("/verify-2fa", BFFController.verify2FA);

/**
 * POST /api/v1/bff/auth/resend-otp
 *
 * Resend email OTP during login flow.
 *
 * Requires: temp-session cookie (set by /auth/login)
 * Note:     Only valid for Email 2FA users
 */
router.post("/resend-otp", BFFController.resendLoginOTP);

// ── Password reset (fully stateless — identity proven by signed reset token) ──

/**
 * GET /api/v1/bff/reset-password/verify
 *
 * Verify password reset token validity.
 *
 * Query: userId, token
 * Returns: { valid: boolean, requiresTwoFactor: boolean }
 */
router.get("/reset-password/verify", validate(verifyTokenSchema), BFFController.verifyResetToken);

/**
 * POST /api/v1/bff/reset-password/complete
 *
 * Complete password reset process.
 *
 * Body: { userId, token, newPassword, totpCode? }
 * Note: totpCode required if user has 2FA enabled
 */
router.post("/reset-password/complete", validate(hardResetPasswordSchema), BFFController.completePasswordReset);

/**
 * POST /api/v1/bff/reset-password/resend-otp
 *
 * Resend OTP during password reset flow.
 *
 * Body: { userId, token }
 * Note: Identity confirmed by signed reset token (no session required)
 */
router.post("/reset-password/resend-otp", BFFController.resendPasswordResetOTP);

// ═══════════════════════════════════════════════════════════════
// PROTECTED ROUTES  (session-ID cookie required)
// ═══════════════════════════════════════════════════════════════

// All routes below require a valid BFF session
router.use(bffAuthenticate);

// Block most routes if the user's session requires a password change
// Exceptions: /auth/change-password, /auth/logout, /session/status
router.use(checkBFFPasswordChangeRequired);

// ── Authentication & Session Management ────────────────────────

/**
 * GET /api/v1/bff/auth/me
 *
 * Get current user profile.
 *
 * Returns: Complete user object with agency info
 */
router.get("/me", BFFController.getCurrentUser);

/**
 * POST /api/v1/bff/auth/refresh
 *
 * Manually refresh access token.
 *
 * Note: This is OPTIONAL. The bffAuthenticate middleware automatically
 * refreshes tokens when they're close to expiry. Use this endpoint only
 * if you want explicit client control over refresh timing.
 *
 * Returns: { accessTokenExpiresAt, refreshTokenRotated }
 */
router.post("/refresh", BFFController.refreshTokens);

/**
 * POST /api/v1/bff/auth/logout
 *
 * Logout from current session.
 *
 * - Revokes current session
 * - Revokes refresh token
 * - Blacklists access token
 * - Clears session cookie
 */
router.post("/logout", BFFController.logout);

/**
 * POST /api/v1/bff/auth/logout-all
 *
 * Logout from ALL devices/sessions.
 *
 * Security: Requires step-up 2FA (X-2FA-Code header)
 *
 * - Revokes all user sessions
 * - Revokes all refresh tokens
 * - Blacklists all access tokens
 * - Clears current session cookie
 */
router.post("/logout-all", requireBFFStepUp, BFFController.logoutAll);

/**
 * POST /api/v1/bff/auth/change-password
 *
 * Change user password.
 *
 * Security: Requires step-up 2FA (X-2FA-Code header)
 *
 * Body: { currentPassword, newPassword }
 *
 * Effects:
 * - Updates password hash
 * - Clears mustChangePassword flag
 * - Invalidates ALL sessions (forces re-login)
 * - Revokes ALL refresh tokens
 *
 * Client must re-login after password change.
 */
router.post("/change-password", requireBFFStepUp, validate(changePasswordSchema), BFFController.changePassword);

// ── Session Management ─────────────────────────────────────────

/**
 * GET /api/v1/bff/session/status
 *
 * Get detailed session status.
 *
 * Returns:
 * - User profile
 * - Session metadata (created, expires, last activity)
 * - Token expiry times (access & refresh)
 * - Remaining idle time
 * - Password change requirement
 *
 * Useful for:
 * - Session health monitoring
 * - Proactive token refresh decisions
 * - User session awareness
 */
router.get("/session/status", BFFController.getSessionStatus);

/**
 * GET /api/v1/bff/sessions
 *
 * List all active sessions for current user.
 *
 * Returns array of sessions with:
 * - Session ID
 * - Creation time
 * - Last activity
 * - Expiration
 * - Device info (IP, user agent)
 * - Current session indicator
 */
router.get("/sessions", BFFController.getSessions);

/**
 * DELETE /api/v1/bff/sessions/:sessionId
 *
 * Revoke a specific session.
 *
 * Security: Requires step-up 2FA (X-2FA-Code header)
 *
 * - If revoking own session, clears cookie
 * - Revokes associated refresh token
 * - Blacklists associated access token
 *
 * Use case: Remove suspicious or forgotten sessions
 */
router.delete("/sessions/:sessionId", requireBFFStepUp, BFFController.revokeSession);

// ── Audit Logs ─────────────────────────────────────────────────

/**
 * GET /api/v1/bff/audit-logs
 *
 * Get audit logs for current user.
 *
 * Query params: action, startDate, endDate, page, limit
 *
 * Returns paginated list of user's security events:
 * - Logins/logouts
 * - Password changes
 * - 2FA events
 * - Session management
 */
router.get("/audit-logs", paginationMiddleware, BFFController.getAuditLogs);

/**
 * GET /api/v1/bff/audit-logs/agency
 *
 * Get audit logs for current user's agency.
 *
 * Access: Typically restricted to ADMIN role (add requireAdmin if needed)
 *
 * Query params: action, entityType, userId, startDate, endDate, page, limit
 *
 * Returns paginated list of agency-wide security events
 */
router.get("/audit-logs/agency", paginationMiddleware, BFFController.getAgencyAuditLogs);

export default router;
