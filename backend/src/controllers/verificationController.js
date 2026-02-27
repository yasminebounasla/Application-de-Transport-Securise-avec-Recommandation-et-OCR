import { prisma } from '../config/prisma.js';
import { encrypt, encryptBuffer, decryptBuffer } from '../config/encryption.js';
import * as ocrService from '../services/ocrService.js';
import * as faceService from '../services/faceService.js';

/**
 *  Convertit une date format "DD.MM.YYYY" (venant de l'OCR) en objet Date valide
 */
const parseOCRDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return null;
  
  const parts = dateString.split('.');
  if (parts.length === 3) {
    const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    const dateObj = new Date(isoDate);
    return isNaN(dateObj.getTime()) ? null : dateObj;
  }
  return null;
};

export async function uploadLicense(req, res) {
  try {
    console.log('🔹 [STEP 1] Starting uploadLicense...');
  const userId = parseInt(req.body.userId);
      const licenseFile = req.file;

    if (!userId) {
      console.log('❌ [ERROR] No userId provided');
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!licenseFile) {
      console.log('❌ [ERROR] No license file provided');
      return res.status(400).json({ error: 'License image is required' });
    }

    console.log('🔹 [STEP 2] Finding driver in database...');
    const driver = await prisma.driver.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!driver) {
      console.log('❌ [ERROR] Driver not found:', userId);
      return res.status(404).json({ error: 'Driver not found' });
    }

    console.log('🔹 [STEP 3] Extracting license data via OCR...');
    const ocrResult = await ocrService.extractLicenseData(
      licenseFile.buffer,
      licenseFile.originalname
    );

    console.log('🔹 [STEP 4] OCR Result:', JSON.stringify(ocrResult, null, 2));

    if (!ocrResult.success) {
      console.log('❌ [ERROR] OCR failed:', ocrResult.error);
      return res.status(400).json({ 
        error: 'Failed to extract license data',
        details: ocrResult.error 
      });
    }

    const { nin, issueDate, expiryDate, confidence } = ocrResult.data;
    console.log('🔹 [STEP 5] Extracted data:', { nin, issueDate, expiryDate, confidence });

    if (!nin) {
      console.log('❌ [ERROR] No NIN extracted');
      return res.status(400).json({ 
        error: 'Could not extract NIN from license. Please ensure the image is clear.' 
      });
    }

    console.log('🔹 [STEP 6] Encrypting NIN...');
    const ninEncrypted = encrypt(nin);

    const parsedIssueDate = parseOCRDate(issueDate);
    const parsedExpiryDate = parseOCRDate(expiryDate);

    console.log('🔹 [STEP 7] Saving to database...');

    const encryptedPermis = encryptBuffer(licenseFile.buffer);

    const license = await prisma.license.upsert({
      where: { driverId: parseInt(userId) },
      update: {
        ninEncrypted,
        permisImage: encryptedPermis,
        issueDate: parsedIssueDate,
        expiryDate: parsedExpiryDate,
        ocrConfidence: confidence,
      },
      create: {
        ninEncrypted,
        permisImage: encryptedPermis,
        issueDate: parsedIssueDate,
        expiryDate: parsedExpiryDate,
        ocrConfidence: confidence,
        driver: {
      connect: { id: parseInt(userId) }  
    }
      },
    });

    console.log('🔹 [STEP 8] License saved:', license.id);

    const responseData = {
      success: true,
      message: 'License uploaded and processed successfully',
      data: {
        licenseId: license.id,
        ocrConfidence: confidence,
        hasExpiryDate: !!expiryDate,
      }
    };

    console.log('[SUCCESS] Sending response:', JSON.stringify(responseData, null, 2));
    res.status(200).json(responseData);

  } catch (error) {
    console.error(' [FATAL ERROR] Upload License Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

export async function uploadSelfie(req, res) {
  try {
    const { userId } = req.body;
    const selfieFile = req.file;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!selfieFile) {
      return res.status(400).json({ error: 'Selfie image is required' });
    }

    const license = await prisma.license.findUnique({
      where: { driverId: parseInt(userId) },
    });

    if (!license) {
      return res.status(404).json({ 
        error: 'License not found. Please upload your license first.' 
      });
    }

    const driver = await prisma.driver.findUnique({
      where: { id: parseInt(userId) },
      select: { hasAcceptedPhotoStorage: true }
    });

    if (!driver?.hasAcceptedPhotoStorage) {
      return res.status(403).json({ 
        error: 'Photo storage consent required. Please accept the terms first.' 
      });
    }

    console.log('Comparing faces...');
    const decryptedPermis = decryptBuffer(license.permisImage); // DÉCHIFFREMENT ICI
    const faceResult = await faceService.compareFaces(
      decryptedPermis,
      selfieFile.buffer
    );

    if (!faceResult.success) {
      return res.status(400).json({ 
        error: 'Face comparison failed',
        details: faceResult.error 
      });
    }

    const {
      verdict,
      similarityScore,
      threshold,
      margin,
      confidence,
      licenseQuality,
      selfieQuality
    } = faceResult.data;

    //  Calcul et vérification
    const isMatch = verdict === 'MATCH' || verdict.includes('MATCH');
    const similarityPercentage = (similarityScore * 100).toFixed(1);

    //  LOGS DE DEBUG 
    console.log('🔹 [DEBUG 1] verdict:', verdict);
    console.log('🔹 [DEBUG 2] verdict.includes(MATCH):', verdict.includes('MATCH'));
    console.log('🔹 [DEBUG 3] isMatch:', isMatch);

    const verification = await prisma.verification.upsert({
      where: { driverId: parseInt(userId) },
      update: {
        selfieImage: selfieFile.buffer,
        similarityScore,
        verdict,
        threshold,
        margin,
        confidence,
        licenseQuality: null,  
        selfieQuality: null,   
        isApproved: isMatch,
      },
      create: {
        driverId: parseInt(userId),
        selfieImage: selfieFile.buffer,
        similarityScore,
        verdict,
        threshold,
        margin,
        confidence,
        licenseQuality: null, 
        selfieQuality: null,   
        isApproved: isMatch,
      },
    });

    await prisma.driver.update({
      where: { id: parseInt(userId) },
      data: { isVerified: isMatch },
    });

    console.log('🔹 [DEBUG 4] verification.isApproved:', verification.isApproved);

    const responseData = {
      success: true,
      message: isMatch ? 'Verification completed successfully' : 'Face verification failed',
      data: {
        verificationId: verification.id,
        verdict,
        similarityScore,
        similarityPercentage,
        confidence,
        isApproved: verification.isApproved,
        licenseQuality,
        selfieQuality,
        ...(isMatch ? {} : {
          userMessage: `Your face doesn't match the license photo. Please try again with better lighting.`
        })
      }
    };

    console.log('📤 [BACKEND SENDING TO FRONTEND]:', JSON.stringify(responseData, null, 2));

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Upload Selfie Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

export async function completeVerification(req, res) {
  try {
    const { userId } = req.body;
    const files = req.files;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!files || !files.license || !files.selfie) {
      return res.status(400).json({ error: 'Both license and selfie images are required' });
    }

    const licenseFile = files.license[0];
    const selfieFile = files.selfie[0];

    const driver = await prisma.driver.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    if (!driver.hasAcceptedPhotoStorage) {
      return res.status(403).json({ 
        error: 'Photo storage consent required. Please accept the terms first.' 
      });
    }

    console.log('Step 1: Extracting license data...');
    const ocrResult = await ocrService.extractLicenseData(
      licenseFile.buffer,
      licenseFile.originalname
    );

    if (!ocrResult.success) {
      return res.status(400).json({ 
        error: 'Failed to extract license data',
        details: ocrResult.error 
      });
    }

    const { nin, issueDate, expiryDate, confidence: ocrConfidence } = ocrResult.data;

    if (!nin) {
      return res.status(400).json({ 
        error: 'Could not extract NIN from license. Please ensure the image is clear.' 
      });
    }

    console.log('Step 2: Comparing faces...');
    const faceResult = await faceService.compareFaces(
      licenseFile.buffer,
      selfieFile.buffer
    );

    if (!faceResult.success) {
      return res.status(400).json({ 
        error: 'Face comparison failed',
        details: faceResult.error 
      });
    }

    const {
      verdict,
      similarityScore,
      threshold,
      margin,
      confidence,
      licenseQuality,
      selfieQuality
    } = faceResult.data;

    console.log('Step 3: Saving to database...');
    const result = await prisma.$transaction(async (tx) => {
      const ninEncrypted = encrypt(nin);
      const encryptedPermis = encryptBuffer(licenseFile.buffer); // CHIFFREMENT ICI

      const parsedIssueDate = parseOCRDate(issueDate);
      const parsedExpiryDate = parseOCRDate(expiryDate);

      const license = await tx.license.upsert({
        where: { driverId: parseInt(userId) },
        update: {
          ninEncrypted,
          permisImage: encryptedPermis,
          issueDate: parsedIssueDate,
          expiryDate: parsedExpiryDate,
          ocrConfidence,
        },
        create: {
          driverId: parseInt(userId),
          ninEncrypted,
          permisImage: encryptedPermis,
          issueDate: parsedIssueDate,
          expiryDate: parsedExpiryDate,
          ocrConfidence,
        },
      });

      const verification = await tx.verification.upsert({
        where: { driverId: parseInt(userId) },
        update: {
          selfieImage: selfieFile.buffer,
          similarityScore,
          verdict,
          threshold,
          margin,
          confidence,
          licenseQuality,
          selfieQuality,
          isApproved: verdict === 'MATCH',
        },
        create: {
          driverId: parseInt(userId),
          selfieImage: selfieFile.buffer,
          similarityScore,
          verdict,
          threshold,
          margin,
          confidence,
          licenseQuality,
          selfieQuality,
          isApproved: verdict === 'MATCH',
        },
      });

      const updatedDriver = await tx.driver.update({
        where: { id: parseInt(userId) },
        data: { isVerified: verdict === 'MATCH' },
      });

      return { license, verification, driver: updatedDriver };
    });

    res.status(200).json({
      success: true,
      message: 'Complete verification processed successfully',
      data: {
        licenseId: result.license.id,
        verificationId: result.verification.id,
        verdict,
        similarityScore,
        confidence,
        isApproved: result.verification.isApproved,
        isVerified: result.driver.isVerified,
        ocrConfidence,
        licenseQuality,
        selfieQuality,
      }
    });
  } catch (error) {
    console.error('Complete Verification Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

export async function getVerificationStatus(req, res) {
  try {
    const { userId } = req.params;

    const driver = await prisma.driver.findUnique({
      where: { id: parseInt(userId) },
      include: {
        verification: true,
        license: {
          select: {
            id: true,
            issueDate: true,
            expiryDate: true,
            ocrConfidence: true,
            createdAt: true,
          }
        }
      }
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    if (!driver.hasAcceptedPhotoStorage) {
      return res.status(403).json({ error: 'Photo storage consent required.' });
    }
    res.status(200).json({
      success: true,
      data: {
        isVerified: driver.isVerified,
        hasLicense: !!driver.license,
        hasVerification: !!driver.verification,
        verification: driver.verification ? {
          verdict: driver.verification.verdict,
          similarityScore: driver.verification.similarityScore,
          confidence: driver.verification.confidence,
          isApproved: driver.verification.isApproved,
          createdAt: driver.verification.createdAt,
        } : null,
        license: driver.license,
      }
    });
  } catch (error) {
    console.error('Get Verification Status Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

export async function updatePhotoConsent(req, res) {
  try {
    const { userId, hasAccepted } = req.body;

    if (!userId || typeof hasAccepted !== 'boolean') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const driver = await prisma.driver.update({
      where: { id: parseInt(userId) },
      data: { hasAcceptedPhotoStorage: hasAccepted },
    });

    res.status(200).json({
      success: true,
      message: 'Photo consent updated',
      data: {
        hasAcceptedPhotoStorage: driver.hasAcceptedPhotoStorage,
      }
    });
  } catch (error) {
    console.error('Update Photo Consent Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

export async function healthCheck(req, res) {
  try {
    const ocrHealth = await ocrService.healthCheck();
    const faceHealth = await faceService.healthCheck();

    res.status(200).json({
      success: true,
      services: {
        ocr: ocrHealth ? 'healthy' : 'unhealthy',
        faceRecognition: faceHealth ? 'healthy' : 'unhealthy',
      },
      allHealthy: ocrHealth && faceHealth,
    });
  } catch (error) {
    console.error('Health Check Error:', error);
    res.status(500).json({ error: 'Health check failed', details: error.message });
  }
}