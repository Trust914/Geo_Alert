import { Router } from "express";
import { USSDController } from "../controllers/ussd.controller.js";

const ussdRouter = Router();

// USSD callback endpoint
ussdRouter.post("/", USSDController.handleUSSD);
ussdRouter.post("", USSDController.handleUSSD);

export default ussdRouter;
