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

import { sendRideRequests, sendFallbackRequests } from '../controllers/sendRequestRide.js';

import { authenticate } from '../middleware/authMiddleware.js';

// ── Routes PASSAGER ───────────────────────────────────────────────────────────
router.post('/',                          authenticate, createRide);                 // Créer une demande
router.get('/my-rides',                   authenticate, getPassengerRides);          // Mes rides
router.get('/activity/passenger/:id',     authenticate, getPassengerRideActivity);   // Activité passager
router.put('/:id/cancel',                 authenticate, cancelRide);                 // Annuler


router.post('/send-requests',             authenticate, sendRideRequests);
router.post('/send-fallback',             authenticate, sendFallbackRequests);

// ── Routes CONDUCTEUR ─────────────────────────────────────────────────────────
router.get('/driver/requests',            authenticate, getDriverRequests);          // Demandes PENDING
router.get('/driver/active',              authenticate, getDriverActiveRides);       // Trajets actifs
router.get('/activity/driver/:id',        authenticate, getDriverRideActivity);      // Activité conducteur
router.get('/:id',                        authenticate, getRideById);                // Détail trajet
router.put('/:id/accept',                 authenticate, acceptRide);                 // Accepter
router.put('/:id/reject',                 authenticate, rejectRide);                 // Refuser
router.put('/:id/start',                  authenticate, startRide);                  // Démarrer
router.put('/:id/complete',              authenticate, completeRide);               // Terminer

export default router;
