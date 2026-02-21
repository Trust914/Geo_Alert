import { Router } from "express";
import { ActivationController } from "../controllers/activation.controller.js";
import { validate } from "../middlewares/validators.middleware.js";
import { completePasswordChangeSchema, resendActivationEmailSchema, verifyTokenSchema } from "../validators/activation.validators.js";

const router = Router();

router.get("/verify", validate(verifyTokenSchema), ActivationController.verifyActivationToken);
router.post("/complete", validate(completePasswordChangeSchema), ActivationController.completeActivation);
router.post("/resend", validate(resendActivationEmailSchema), ActivationController.resendActivationEmail);

export default router;
