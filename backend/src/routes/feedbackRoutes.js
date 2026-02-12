import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { submitFeedback } from "../controllers/feedbackController.js";

const router = express.Router();

router.post("/", authenticate, submitFeedback);

export default router;