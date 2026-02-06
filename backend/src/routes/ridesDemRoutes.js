import express from 'express';
const router = express.Router();
import {
  createRide,
  getPassengerRides,
  getDriverRequests,
  rejectRide,      
  startRide,      
  completeRide,   
  cancelRide,      
} from '../controllers/rideController.js';


//Créer une demande
router.post('/', createRide);

//Rides d'un passager
router.get('/passenger/:id', getPassengerRides);

//Demandes PENDING pour un conducteur
router.get('/driver/:id', getDriverRequests);

//Refuser une demande
router.put('/:id/reject', rejectRide);

//Démarrer un trajet
router.put('/:id/start', startRide);

//Terminer un trajet
router.put('/:id/complete', completeRide);

//Annuler un trajet (passager)
router.put('/:id/cancel', cancelRide);

export default router;