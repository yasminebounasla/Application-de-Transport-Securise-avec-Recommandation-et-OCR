import express from "express";
import { recommendDrivers } from "../controllers/recommendationController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/recommendations", authenticate, recommendDrivers);

export default router;
