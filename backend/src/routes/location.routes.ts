import { Router } from "express";
import { LocationController } from "../controllers/location.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAlertWriteAccess } from "../middlewares/roles.middleware.js";
import { bffAuthenticate } from "../middlewares/bff.middleware.js";

const router = Router();

// router.use(authenticate, requireAlertWriteAccess);
router.use(bffAuthenticate, requireAlertWriteAccess);

router.get("/states", LocationController.getStates);
router.get("/states/:stateId/lgas", LocationController.getLgas);
router.get("/lgas/:lgaId/wards", LocationController.getWards);

export default router;