import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { 
  getMyPassengerProfile,
  getPassengerProfile,
  updatePassengerProfile,
  getDriverInteractions
} from "../controllers/passengerController.js";

const router = express.Router();

router.get("/me", authenticate, getMyPassengerProfile);
router.put("/profile", authenticate, updatePassengerProfile);
router.get("/:id", authenticate, getPassengerProfile);

router.get("/:id/driver-interactions", authenticate, getDriverInteractions)

export default router;
