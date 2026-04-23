import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { uploadAvatar, handleMulterError } from "../middleware/uploadMiddleware.js";
import { 
  getMyPassengerProfile,
  getPassengerProfile,
  updatePassengerProfile,
  uploadPassengerAvatar,
  getDriverInteractions
} from "../controllers/passengerController.js";

const router = express.Router();

router.get("/me", authenticate, getMyPassengerProfile);
router.put("/profile", authenticate, updatePassengerProfile);
router.post('/avatar', authenticate, uploadAvatar, handleMulterError, uploadPassengerAvatar);
router.get("/:id", authenticate, getPassengerProfile);

router.get("/:id/driver-interactions", authenticate, getDriverInteractions)

export default router;
