import express from 'express';
import { recommendDrivers } from '../controllers/recommendationController.js';

const router = express.Router();

router.post('/recommendations', recommendDrivers);

export default router;