import express from 'express';
import { registerDriver, loginDriver, validateDriverLogin, getAllDrivers, refreshDriverToken, checkEmailExists, checkPhoneExists } from '../controllers/authDriverController.js';
import { registerPassenger, loginPassenger, validatePassengerLogin, refreshPassengerToken } from '../controllers/authPassengerController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Routes for Driver authentication
router.post('/driver/register', registerDriver);
router.post('/driver/validate-login', validateDriverLogin);
router.post('/driver/login', loginDriver);
router.get('/driver/all', authenticate, getAllDrivers);
router.post('/check-email', checkEmailExists);
router.post('/check-phone', checkPhoneExists);


// Routes for Passenger authentication
router.post('/passenger/register', registerPassenger);
router.post('/passenger/validate-login', validatePassengerLogin);
router.post('/passenger/login', loginPassenger);

router.post('/driver/refresh', refreshDriverToken);
router.post('/passenger/refresh', refreshPassengerToken);

export default router;
