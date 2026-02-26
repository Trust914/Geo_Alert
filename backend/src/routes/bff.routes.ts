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

router.post("/login", validate(loginSchema), BFFController.login);
router.post("/verify-2fa", BFFController.verify2FA);
router.post("/resend-otp", BFFController.resendLoginOTP);
router.get("/reset-password/verify", validate(verifyTokenSchema), BFFController.verifyResetToken);
router.post("/reset-password/complete", validate(hardResetPasswordSchema), BFFController.completePasswordReset);
router.post("/reset-password/resend-otp", BFFController.resendPasswordResetOTP);

// All routes below require a valid BFF session
router.use(bffAuthenticate);
router.use(checkBFFPasswordChangeRequired);

router.get("/me", BFFController.getCurrentUser);
router.post("/refresh", BFFController.refreshTokens);
router.post("/logout", BFFController.logout);
router.post("/logout-all", requireBFFStepUp, BFFController.logoutAll);
router.post("/change-password", requireBFFStepUp, validate(changePasswordSchema), BFFController.changePassword);

router.get("/session/status", BFFController.getSessionStatus);
router.get("/sessions", BFFController.getSessions);
router.delete("/sessions/:sessionId", requireBFFStepUp, BFFController.revokeSession);

router.get("/audit-logs", paginationMiddleware, BFFController.getAuditLogs);
router.get("/audit-logs/agency", paginationMiddleware, BFFController.getAgencyAuditLogs);

export default router;
