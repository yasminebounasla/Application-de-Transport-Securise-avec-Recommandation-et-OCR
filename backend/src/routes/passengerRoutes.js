import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { addPassengerPreferences ,
  getPassengerPreferences,
  getMyPassengerProfile,
  getPassengerProfile,
  updatePassengerProfile,

} from "../controllers/passengerController.js";

const router = express.Router();

router.patch("/preferences", authenticate, addPassengerPreferences);
router.get("/preferences", authenticate, getPassengerPreferences);

router.get("/me", authenticate, getMyPassengerProfile);
router.put("/profile", authenticate, updatePassengerProfile);
router.get("/:id", authenticate, getPassengerProfile);

export default router;
