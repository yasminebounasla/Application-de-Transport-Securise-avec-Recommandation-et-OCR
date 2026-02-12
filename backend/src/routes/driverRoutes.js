import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { addDriverPreferences, getDriverRating } from "../controllers/driverController.js";

const router = express.Router();

router.put("/preferences", authenticate, addDriverPreferences);  
router.get("/:driverId/rating", authenticate, getDriverRating);

export default router;
