import express from 'express';
import { registerDriver, loginDriver, getAllDrivers, refreshDriverToken, checkEmailExists } from '../controllers/authDriverController.js';
import { registerPassenger, loginPassenger, refreshPassengerToken } from '../controllers/authPassengerController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Routes for Driver authentication
router.post('/driver/register', registerDriver);
router.post('/driver/login', loginDriver);
router.get('/driver/all', authenticate, getAllDrivers);
router.post('/check-email', checkEmailExists);


// Routes for Passenger authentication
router.post('/passenger/register', registerPassenger);
router.post('/passenger/login', loginPassenger);

router.post('/driver/refresh', refreshDriverToken);
router.post('/passenger/refresh', refreshPassengerToken);

export default router;
