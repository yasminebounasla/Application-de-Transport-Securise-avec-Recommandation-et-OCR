import express from 'express';
import { recommendDrivers, bulkDrivers } from '../controllers/recommendationController.js';

const router = express.Router();

router.post('/recommendations', recommendDrivers);
router.post('/bulk', bulkDrivers);  // Pour le service ML

export default router;