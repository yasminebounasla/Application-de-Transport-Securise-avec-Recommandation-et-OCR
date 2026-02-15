import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { 
    submitFeedback, 
    getFeedbackByTrajet, 
    getDriverFeedback,
    getDriverStats,
    getPublicDriverStats,
    getPublicDriverFeedback
} from '../controllers/feedbackController.js';

const router = express.Router();

// ===== ROUTES POUR PASSAGERS =====

router.post("/submit", authenticate, submitFeedback);
router.get("/trajet/:trajetId", authenticate, getFeedbackByTrajet); 

// Voir les stats publiques d'un driver (pour choisir un driver)
router.get('/driver/:driverId/stats', authenticate, getPublicDriverStats);

// Voir les feedbacks publics d'un driver (pour voir son profil)
router.get('/driver/:driverId/public', authenticate, getPublicDriverFeedback);


// ===== ROUTES POUR DRIVERS =====

// Voir SES propres stats (avg rating + total)
router.get('/my-stats', authenticate, getDriverStats);

// Voir TOUS SES feedbacks 
router.get('/my-feedbacks', authenticate, getDriverFeedback);



export default router;



