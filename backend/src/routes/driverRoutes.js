import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { addDriverPreferences, getDriverRating ,
  addVehicle,
  updateVehicle,
  getDriverVehicles,
  deleteVehicle } from "../controllers/driverController.js";

const router = express.Router();

router.put("/preferences", authenticate, addDriverPreferences);  
router.get("/:driverId/rating", authenticate, getDriverRating);

router.post("/vehicle", authenticate, addVehicle);
router.get("/vehicle", authenticate, getDriverVehicles);
router.put("/vehicle/:vehicleId", authenticate, updateVehicle);
router.delete("/vehicle/:vehicleId", authenticate, deleteVehicle);

export default router;
