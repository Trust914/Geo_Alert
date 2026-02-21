import { Router } from "express";
import { SMSController } from "../controllers/sms.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { checkPasswordChangeRequired } from "../middlewares/firstLogin.middleware.js";
import { checkRole } from "../middlewares/roles.middleware.js";
import { validate } from "../middlewares/validators.middleware.js";
import { UserRole } from "../prisma/prisma/generated/enums.js";
import { logger } from "../utils/logger.util.js";
import { alertIdSchema, BatchDeliveryReportSchema, DeliveryReportSchema } from "../validators/alert.validators.js";
import { bffAuthenticate, checkBFFPasswordChangeRequired } from "../middlewares/bff.middleware.js";

const router = Router();

// SMS callback endpoints
router.post("/incoming", SMSController.handleIncomingSMS);
// smsRouter.post("/delivery-reports", SMSController.handleDeliveryReport);
router.post(
  "/delivery-reports",
  (req, res, next) => {
    // Dynamic validation based on input type
    logger.debug("Validating delivery report input", { body: req.body });
    if (Array.isArray(req.body)) {
      return validate(BatchDeliveryReportSchema)(req, res, next);
    }
    return validate(DeliveryReportSchema)(req, res, next);
  },
  SMSController.handleDeliveryReport,
);

// router.use(authenticate, checkPasswordChangeRequired);
router.use(bffAuthenticate, checkBFFPasswordChangeRequired);
// router.get("/:alertId/stats", validate(alertIdSchema), authenticate, SMSController.getAlertDeliveryStats);

router.get("/:alertId/stats", validate(alertIdSchema), SMSController.getAlertDeliveryStats);

const retryAllowedRoles = [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.OPERATOR];
router.post("/:alertId/retry", checkRole(retryAllowedRoles), validate(alertIdSchema), SMSController.retryFailedDeliveries);

export default router;
