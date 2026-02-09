import express from 'express';
const router = express.Router();
import {
  createRide,
  getPassengerRides,
  getDriverRequests,
  acceptRide,
  rejectRide,      
  startRide,      
  completeRide,   
  cancelRide,      
} from '../controllers/rideController.js';
import { authenticate } from '../middleware/authMiddleware.js'; 

// Routes PASSAGER (protégées par authenticate)
router.post('/', authenticate, createRide);              // Créer une demande
router.get('/my-rides', authenticate, getPassengerRides); // Mes rides
router.put('/:id/cancel', authenticate, cancelRide);      // Annuler

// Routes CONDUCTEUR (protégées par authenticate)
router.get('/driver/requests', authenticate, getDriverRequests); // Demandes PENDING
router.put('/:id/accept', authenticate, acceptRide);             // Accepter
router.put('/:id/reject', authenticate, rejectRide);             // Refuser
router.put('/:id/start', authenticate, startRide);               // Démarrer
router.put('/:id/complete', authenticate, completeRide);         // Terminer

export default router;