import { Router } from "express";
import { CitizenController } from "../controllers/citizen.contoller.js";
import { paginationMiddleware, sortMiddleware } from "../middlewares/additional.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAlertWriteAccess } from "../middlewares/roles.middleware.js";
import { validate } from "../middlewares/validators.middleware.js";
import { citizenFilterSchema, citizenPhoneSchema, citizensNearbySchema, registerCitizenSchema, updateCitizenSchema } from "../validators/citizen.validators.js";
import { bffAuthenticate } from "../middlewares/bff.middleware.js";

const router = Router();

// --- Public ---
router.post("/register", validate(registerCitizenSchema), CitizenController.registerCitizen);

// --- Protected ---
// router.use(authenticate);
router.use(bffAuthenticate);

// Viewers can read citizen data to understand demographics
router.get("/", paginationMiddleware, sortMiddleware, validate(citizenFilterSchema), CitizenController.getCitizens);
router.get("/statistics", CitizenController.getStatistics);
router.get("/nearby", validate(citizensNearbySchema), CitizenController.getCitizensNearby);
router.get("/phone/:phoneNumber", validate(citizenPhoneSchema), CitizenController.getCitizenByPhone);
router.get("/:id", CitizenController.getCitizenById);

// Operators+ can modify citizen data (e.g., manual opt-out requests)
router.put("/:phoneNumber", requireAlertWriteAccess, validate(updateCitizenSchema), CitizenController.updateCitizen);
router.post("/:phoneNumber/opt-in", requireAlertWriteAccess, validate(citizenPhoneSchema), CitizenController.optIn);
router.post("/:phoneNumber/opt-out", requireAlertWriteAccess, validate(citizenPhoneSchema), CitizenController.optOut);

export default router;
