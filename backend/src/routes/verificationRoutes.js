import express from 'express';
import {
  uploadLicense,
  uploadSelfie,
  handleMulterError
} from '../middleware/uploadMiddleware.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { registerDriver } from '../controllers/authDriverController.js';

import {

    uploadLicense as uploadLicenseController,
    uploadSelfie as uploadSelfieController,
    getVerificationStatus,
    updatePhotoConsent,
    healthCheck,
    getDriverSelfie
} from '../controllers/verificationController.js';

const router = express.Router();


router.post('/register', registerDriver);

router.post('/consent', authenticate, updatePhotoConsent);

// // Add this log at the VERY top of your upload-license route
router.post('/upload-license', (req, res, next) => {
    console.log("!!! ATTACK DETECTED - ROUTE HIT !!!");
    console.log("Auth Header:", req.headers.authorization ? "Present" : "MISSING");
    next();
}, authenticate, uploadLicense, handleMulterError, uploadLicenseController);
router.post('/upload-selfie', authenticate, uploadSelfie, handleMulterError, uploadSelfieController);

/**
 * Obtenir le statut de vérification
 */
router.get(
  '/status/:userId',
  authenticate,
  getVerificationStatus
);

/**
 * Mettre à jour le consentement de stockage photo
 */
router.post(
  '/consent',
  authenticate,
  updatePhotoConsent
);
// router.get('/driver/:userId/selfie', authenticate, getDriverSelfie);
router.get('/driver/:userId/selfie', (req, res, next) => {
  console.log('🔍 Selfie route hit, userId:', req.params.userId);
  console.log('🔍 Auth header:', req.headers.authorization ? 'Present' : 'MISSING');
  next();
}, authenticate, getDriverSelfie);

/**
 * Health check des services
 */
router.get('/health', healthCheck);

export default router;
