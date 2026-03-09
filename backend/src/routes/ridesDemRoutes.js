import express from 'express';
const router = express.Router();
import {
  createRide,
  getPassengerRides,
  getRideById,
  getDriverRequests,
  getDriverActiveRides,
  getPassengerRideActivity,
  getDriverRideActivity,
  acceptRide,
  rejectRide,
  startRide,
  completeRide,
  cancelRide,
} from '../controllers/rideController.js';
import { authenticate } from '../middleware/authMiddleware.js';

// Routes PASSAGER (protegees par authenticate)
router.post('/', authenticate, createRide);               // Creer une demande
router.get('/my-rides', authenticate, getPassengerRides); // Mes rides
router.get('/activity/passenger/:id', authenticate, getPassengerRideActivity); // Activite passager
router.put('/:id/cancel', authenticate, cancelRide);      // Annuler

// Routes CONDUCTEUR (protegees par authenticate)
router.get('/driver/requests', authenticate, getDriverRequests); // Demandes PENDING
router.get('/driver/active', authenticate, getDriverActiveRides);   // Trajets actifs
router.get('/activity/driver/:id', authenticate, getDriverRideActivity); // Activite conducteur
router.get('/:id', authenticate, getRideById);                  // Detail trajet
router.put('/:id/accept', authenticate, acceptRide);             // Accepter
router.put('/:id/reject', authenticate, rejectRide);             // Refuser
router.put('/:id/start', authenticate, startRide);               // Demarrer
router.put('/:id/complete', authenticate, completeRide);         // Terminer

export default router;
