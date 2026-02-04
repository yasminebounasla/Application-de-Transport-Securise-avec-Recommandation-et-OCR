import express from 'express';
import { registerDriver, loginDriver, getAllDrivers } from '../controllers/authDriverController.js';
import { registerPassenger, loginPassenger } from '../controllers/authPassengerController.js';

const router = express.Router();

// Routes for Driver authentication
router.post('/driver/register', registerDriver);
router.post('/driver/login', loginDriver);
router.get('/driver/All', getAllDrivers);


// Routes for Passenger authentication
router.post('/passenger/register', registerPassenger);
router.post('/passenger/login', loginPassenger);

export default router;