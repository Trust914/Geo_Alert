import { Router } from "express";
import { TwoFactorController } from "../controllers/twoFactorAuth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireTwoFactor } from "../middlewares/twoFactorAuth.middlewares.js";
import { validate } from "../middlewares/validators.middleware.js";
import { disable2FASchema, setupTOTPSchema, verifyEmailSetupSchema, verifyTOTPSchema } from "../validators/twoFactorAuth.validators.js";
import { bffAuthenticate } from "../middlewares/bff.middleware.js";

const router = Router();

// All routes require authentication
// router.use(authenticate);
router.use(bffAuthenticate);

// Get 2FA status
router.get("/status", TwoFactorController.get2FAStatus);

// TOTP (Google Authenticator) routes
router.post("/totp/setup", TwoFactorController.setupTOTP);
router.post("/totp/verify", validate(verifyTOTPSchema), TwoFactorController.verifyTOTP);

// Email 2FA routes - TWO STEP PROCESS
router.post("/email/initiate-setup", TwoFactorController.initiateEmail2FASetup);
router.post("/email/verify-and-enable", validate(verifyEmailSetupSchema), TwoFactorController.verifyAndEnableEmail2FA);

router.post("/request-otp", TwoFactorController.requestOtp);

// Verify user password for sensitive actions
router.post("/verify-password", TwoFactorController.verifyPassword);

// Generating new backup codes (invalidates old ones)
router.post("/backup-codes/regenerate", requireTwoFactor, TwoFactorController.regenerateBackupCodes);

// Disable 2FA (requires password confirmation)
router.post("/disable", validate(disable2FASchema), requireTwoFactor, TwoFactorController.disable2FA);

export default router;
