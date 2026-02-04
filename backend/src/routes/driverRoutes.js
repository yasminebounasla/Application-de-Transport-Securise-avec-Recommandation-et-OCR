import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { addDriverPreferences } from "../controllers/driverController.js";

const router = express.Router();

router.patch("/preferences", authenticate, addDriverPreferences);  
export default router;
