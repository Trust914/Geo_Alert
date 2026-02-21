import { Router } from "express";
import { UserController } from "../controllers/user.controller.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { checkPasswordChangeRequired } from "../middlewares/firstLogin.middleware.js";
import { requireTwoFactor } from "../middlewares/twoFactorAuth.middlewares.js";
import { validate } from "../middlewares/validators.middleware.js";
import { createUserSchema, updateUserSchema, userFiltersSchema, userIdSchema } from "../validators/user.validators.js";
import { paginationMiddleware, sortMiddleware } from "../middlewares/additional.middleware.js";
import { bffAuthenticate, checkBFFPasswordChangeRequired, requireBFFStepUp } from "../middlewares/bff.middleware.js";

const router = Router();

// All routes require authentication
// router.use(authenticate);
router.use(bffAuthenticate);

// Block access if password change is required
// router.use(checkPasswordChangeRequired);

router.use(checkBFFPasswordChangeRequired);

// Admin-only routes
router.post("/create", requireAdmin, validate(createUserSchema), UserController.createUser);
router.get("/agency/:agencyId", requireAdmin, paginationMiddleware, sortMiddleware, validate(userFiltersSchema), UserController.getAgencyUsers);
router.put("/:id/update", requireAdmin, validate(userIdSchema), validate(updateUserSchema), UserController.updateUser);
// GET /user — Super Admin: all users across all agencies
router.get("/", requireAdmin, paginationMiddleware, sortMiddleware, UserController.getAllUsers);

// [HIGH RISK] Deactivating a user (potential DoS against staff)
// router.post("/:id/deactivate", requireAdmin, requireTwoFactor, validate(userIdSchema), UserController.deactivateUser);

router.post("/:id/deactivate", requireAdmin, requireBFFStepUp, validate(userIdSchema), UserController.deactivateUser);
router.post("/:id/reactivate", requireAdmin, validate(userIdSchema), UserController.reactivateUser);

// [HIGH RISK] Force password reset
// router.post("/:id/reset-password", requireAdmin, requireTwoFactor, validate(userIdSchema), UserController.resetUserPassword);

router.post("/:id/reset-password", requireAdmin, requireBFFStepUp, validate(userIdSchema), UserController.resetUserPassword);
// Routes accessible by user themselves or admin
router.get("/:id/", validate(userIdSchema), UserController.getUserById);

export default router;
