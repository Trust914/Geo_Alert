import { Router } from "express";
import { AgencyController } from "../controllers/agency.controller.js";
import { paginationMiddleware, sortMiddleware } from "../middlewares/additional.middleware.js";
import { requireSuperAdmin, requireAgencyAdminOrSuperAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validators.middleware.js";
import { agencyFiltersSchema, agencyIdSchema, createAgencySchema, updateAgencySchema } from "../validators/agency.validators.js";
import { bffAuthenticate, checkBFFPasswordChangeRequired, requireBFFStepUp } from "../middlewares/bff.middleware.js";

const router = Router();

// All routes require BFF authentication and password check
router.use(bffAuthenticate, checkBFFPasswordChangeRequired);

// Super admin only
router.get("/stats", requireSuperAdmin, AgencyController.getAgencyStats);
router.post("/", requireSuperAdmin, validate(createAgencySchema), AgencyController.createAgency);
router.get("/", requireSuperAdmin, paginationMiddleware, sortMiddleware, validate(agencyFiltersSchema), AgencyController.getAllAgencies);
router.post("/:id/reactivate", requireSuperAdmin, validate(agencyIdSchema), AgencyController.reactivateAgency);
router.put("/:id", requireSuperAdmin, requireBFFStepUp, validate(updateAgencySchema), AgencyController.updateAgency);
router.delete("/:id", requireSuperAdmin, requireBFFStepUp, validate(agencyIdSchema), AgencyController.deleteAgency);

// Super admin OR the agency's own admin
router.get("/:id", requireAgencyAdminOrSuperAdmin, validate(agencyIdSchema), AgencyController.getAgencyById);

export default router;