import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { addPassengerPreferences } from "../controllers/passengerController.js";

const router = express.Router();

router.patch("/preferences", authenticate, addPassengerPreferences);

export default router;
