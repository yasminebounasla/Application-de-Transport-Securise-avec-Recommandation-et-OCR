import express from "express";
import { authenticate } from "../middlewares/authMiddleware.js";
import { addDriverpreferances } from "../controllers/driverPreferencesController.js";

const router = express.Router();

router.patch("/drivers/preferences", authenticate, addDriverpreferances);

export default router;
