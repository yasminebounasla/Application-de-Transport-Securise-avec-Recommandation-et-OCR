import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { 
    submitFeedback, 
    getFeedbackByTrajet  
} from "../controllers/feedbackController.js";

const router = express.Router();

router.post("/", authenticate, submitFeedback);
router.get("/trajet/:trajetId", authenticate, getFeedbackByTrajet); 

export default router;