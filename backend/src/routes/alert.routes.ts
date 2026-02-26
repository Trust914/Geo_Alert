import { Router } from "express";
import { AlertController } from "../controllers/alert.controller.js";
import { paginationMiddleware, sortMiddleware } from "../middlewares/additional.middleware.js";
import { requireAlertWriteAccess } from "../middlewares/roles.middleware.js";
import { validate } from "../middlewares/validators.middleware.js";
import { alertFiltersSchema, alertIdSchema, cancelAlertSchema, createAlertSchema, estimateRecipientsSchema } from "../validators/alert.validators.js";
import { bffAuthenticate, checkBFFPasswordChangeRequired, requireBFFStepUp } from "../middlewares/bff.middleware.js";

const router = Router();

// All alert routes require an active BFF session
router.use(bffAuthenticate, checkBFFPasswordChangeRequired);

// ─────────────────────────────────────────────────────────────────
// READ OPERATIONS
// Accessible by all authenticated roles (Admin, Coordinator, Operator, Viewer)
// Service layer scopes results to own agency (super admin sees all)
// ─────────────────────────────────────────────────────────────────
router.get("/", paginationMiddleware, sortMiddleware, validate(alertFiltersSchema), AlertController.getAlerts);

router.get("/:alertId", validate(alertIdSchema), AlertController.getAlertById);

router.get("/:alertId/stats", validate(alertIdSchema), AlertController.getAlertStats);

// ─────────────────────────────────────────────────────────────────
// WRITE OPERATIONS
// Allowed: Admin, Coordinator, Operator
// Denied:  Viewer (enforced by requireAlertWriteAccess middleware)
// ─────────────────────────────────────────────────────────────────
router.post("/", requireAlertWriteAccess, validate(createAlertSchema), AlertController.createAlert);

router.get("/:alertId/preview", requireAlertWriteAccess, validate(alertIdSchema), AlertController.previewAlert);

router.post("/estimate-recipients", requireAlertWriteAccess, validate(estimateRecipientsSchema), AlertController.estimateRecipients);

// ─────────────────────────────────────────────────────────────────
// CRITICAL OPERATIONS — require 2FA step-up
// Send:   Admin, Coordinator, Operator (all vetted before system access)
// Cancel: Admin, Coordinator, Operator (service restricts Operators to own DRAFTs)
// ─────────────────────────────────────────────────────────────────
router.post("/:alertId/send", requireAlertWriteAccess, requireBFFStepUp, validate(alertIdSchema), AlertController.sendAlert);

router.post("/:alertId/cancel", requireAlertWriteAccess, requireBFFStepUp, validate(alertIdSchema), validate(cancelAlertSchema), AlertController.cancelAlert);

export default router;
