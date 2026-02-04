import express from "express";
import { authenticate } from "../middlewares/authMiddleware.js";
import { addDriverPreferances } from "../controllers/driverPreferencesController.js";

const router = express.Router();

router.patch("/drivers/preferences", authenticate, addDriverPreferances);  
export default router;
