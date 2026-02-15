import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { addDriverPreferences, getDriverRating ,
  addVehicle,
  updateVehicle,
  getDriverVehicles,
  deleteVehicle ,
  getDriverPreferences,
  getDriverProfile,
  getMyDriverProfile,
  updateDriverProfile
} from "../controllers/driverController.js";

const router = express.Router();

router.put("/preferences", authenticate, addDriverPreferences);  
router.get("/:driverId/rating", authenticate, getDriverRating);
router.get("/preferences", authenticate, getDriverPreferences);

router.post("/vehicle", authenticate, addVehicle);
router.get("/vehicle", authenticate, getDriverVehicles);
router.put("/vehicle/:vehicleId", authenticate, updateVehicle);
router.delete("/vehicle/:vehicleId", authenticate, deleteVehicle);

router.get("/me", authenticate, getMyDriverProfile);
router.put("/profile", authenticate, updateDriverProfile);
router.get("/:id", authenticate, getDriverProfile); 

export default router;
