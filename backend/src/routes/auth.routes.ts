import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { paginationMiddleware } from "../middlewares/additional.middleware.js";
import { authenticate, requirePreAuth } from "../middlewares/auth.middleware.js";
import { checkPasswordChangeRequired } from "../middlewares/firstLogin.middleware.js";
import { requireTwoFactor } from "../middlewares/twoFactorAuth.middlewares.js";
import { validate } from "../middlewares/validators.middleware.js";
import { completePasswordChangeSchema, verifyTokenSchema } from "../validators/activation.validators.js";
import { agencyAuditLogFiltersSchema, auditLogFiltersSchema, changePasswordSchema, hardResetPasswordSchema, loginSchema } from "../validators/auth.validators.js";

const router = Router();

// Initial Login Returns preAuthToken
router.post("/login", AuthController.login);

// Verify 2FA Requires preAuthToken
router.post("/two-factor/verify-login", requirePreAuth, AuthController.verifyTwoFactor);

// Uses requirePreAuth to ensure user has passed password check recently
router.post("/two-factor/resend", requirePreAuth, AuthController.resendTwoFactorCode);

router.post("/refresh", AuthController.refreshToken);
router.post("/logout", AuthController.logout);

// hard reset password initiated by Admin
router.get("/reset-password/verify", validate(verifyTokenSchema), AuthController.verifyResetToken);
router.post("/reset-password/complete", validate(hardResetPasswordSchema), AuthController.completePasswordReset);

// --- Authenticated Routes ---
router.use(authenticate);
router.use(checkPasswordChangeRequired);

router.get("/me", AuthController.getCurrentUser);
router.get("/sessions", AuthController.getSessions);
router.get("/audit-logs", paginationMiddleware, validate(auditLogFiltersSchema), AuthController.getAuditLogs);
router.get("/agency/audit-logs", paginationMiddleware, validate(agencyAuditLogFiltersSchema), AuthController.getAgencyAuditLogs);

// --- User wants to change their password ---
router.post("/change-password", requireTwoFactor, validate(changePasswordSchema), AuthController.changePassword);

router.post("/logout-all", requireTwoFactor, AuthController.logoutAll);

router.delete("/sessions/:sessionId", requireTwoFactor, AuthController.revokeSession);

export default router;
