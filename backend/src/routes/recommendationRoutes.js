import express from "express";
import { recommendDrivers } from "../controllers/recommendationController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// 🔹 Middleware express.json() doit être activé dans ton app principal
// app.use(express.json());

router.post("/recommendations", authenticate, recommendDrivers);

export default router;