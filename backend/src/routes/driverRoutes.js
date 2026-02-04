import express from "express";
<<<<<<< Updated upstream
import { authenticate } from "../middleware/authMiddleware.js";
import { addDriverPreferences } from "../controllers/driverController.js";

const router = express.Router();

router.put("/preferences", authenticate, addDriverPreferences);  
=======
import { authenticate } from "../middlewares/authMiddleware.js";
import { addDriverpreferances } from "../controllers/driverPreferencesController.js";

const router = express.Router();

router.patch("/drivers/preferences", authenticate, addDriverpreferances);

>>>>>>> Stashed changes
export default router;
