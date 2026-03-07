import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  getMyNotifications,
  markAllAsRead,
  markOneAsRead,
  clearMyNotifications,
} from '../controllers/NotificationController.js';

const router = express.Router();

router.get('/',                  authenticate, getMyNotifications);
router.patch('/read-all',        authenticate, markAllAsRead);
router.patch('/:id/read',        authenticate, markOneAsRead);
router.delete('/',               authenticate, clearMyNotifications);

export default router;

// ── Dans app.js, ajouter : ────────────────────────────────────────────────────
// import notificationRoutes from './src/routes/notificationRoutes.js';
// app.use('/api/notifications', notificationRoutes);