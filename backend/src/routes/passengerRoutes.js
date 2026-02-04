import express from "express";
import { authenticate } from "../middlewares/authMiddleware.js";
import { addPassengerPreferences } from "../controllers/passengerController.js";

const router = express.Router();

router.patch("/passengers/preferences", authenticate, addPassengerPreferences);

export default router;
