import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  getSavedPlaces,
  addSavedPlace,
  updateSavedPlace,
  deleteSavedPlace,
} from "../controllers/savedPlacesController.js";

const router = express.Router();

router.get("/",          authenticate, getSavedPlaces);
router.post("/",         authenticate, addSavedPlace);
router.put("/:id",       authenticate, updateSavedPlace);
router.delete("/:id",    authenticate, deleteSavedPlace);

export default router;