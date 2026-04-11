import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';


// URL du backend - Change avec TON IP
const API_URL = process.env.EXPO_PUBLIC_API_URL ;
console.log("🌐 API_URL:", API_URL); // Add this line


/**
 * Récupère le token JWT depuis AsyncStorage
 */
const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

/**
 * Headers avec authentification
 * Accepte un manualToken optionnel pour les nouveaux inscrits
 */
const getAuthHeaders = async (manualToken = null) => {
  const token = manualToken || await getAuthToken();

  if (!token) {
    console.warn('⚠️ No token available for authenticated request');
  } else {
    console.log('📌 Using token:', manualToken ? 'Manual (Fresh)' : 'Storage');
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

/**
 * Mettre à jour le consentement de stockage photo
 */
export const updatePhotoConsent = async (data, manualToken = null) => {
  try {
    const headers = await getAuthHeaders(manualToken);
    console.log('📤 Updating photo consent for user:', data.userId);

    await axios.post(`${API_URL}/verification/consent`, data, { headers });

    console.log('✅ Photo consent updated successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Update consent error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.message || 'Failed to update consent',
    };
  }
};

/**
 * Upload permis de conduire
 */
export const uploadLicense = async (userId, imageUri, manualToken = null) => {
  try {
    // Safety guard
    if (!API_URL) throw new Error("API_URL is not defined. Check your .env file.");

    console.log("🔍 Debugging Upload:");
    console.log("- UserID:", userId);
    console.log("- Image URI:", imageUri);
    console.log("- Token Present:", !!manualToken);
    console.log("- API URL:", API_URL); // ← confirm it's loaded

    const headers = await getAuthHeaders(manualToken);
    const formData = new FormData();
    formData.append('userId', userId.toString());
    formData.append('license', {
      uri: imageUri,
      name: 'license.jpg',
      type: 'image/jpeg',
    });

    console.log('📤 Uploading license... (This may take 2-5 minutes)');

    const response = await axios.post(`${API_URL}/verification/upload-license`, formData, {
      headers: {
        ...headers,
        'Content-Type': 'multipart/form-data'
      },
      timeout: 1500000,
    });

    console.log('✅ License uploaded successfully');
    return { success: true, ...response.data };

  } catch (error) {
    console.error('❌ Upload license error:', error.response?.data || error.message);

    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Request timed out. The OCR service may be overloaded. Please try again.'
      };
    }

    const serverError = error.response?.data?.error || error.response?.data?.message || 'Failed to upload';
    return { success: false, error: serverError };
  }
};
/**
 * Upload selfie
 */
export const uploadSelfie = async (userId, imageUri, manualToken = null) => {
  try {
    const headers = await getAuthHeaders(manualToken);

    console.log('📤 Uploading selfie for user:', userId);

    const formData = new FormData();
    formData.append('userId', userId.toString());

    const filename = imageUri.split('/').pop() || 'selfie.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('selfie', {
      uri: imageUri,
      name: filename,
      type,
    });

    const response = await axios.post(
      `${API_URL}/verification/upload-selfie`,
      formData,
      {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 1500000,
      }
    );

    console.log('✅ Selfie uploaded successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Upload selfie error:', error.response?.data || error.message);

    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Request timed out. Please try again.'
      };
    }

    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.message || 'Failed to upload selfie',
      details: error.response?.data?.details,
    };
  }
};

/**
 * Vérification complète (permis + selfie en une fois)
 */
export const completeVerification = async (data, manualToken = null) => {
  try {
    const headers = await getAuthHeaders(manualToken);

    const formData = new FormData();
    formData.append('userId', data.userId.toString());

    // License
    const licenseFilename = data.licenseUri.split('/').pop() || 'license.jpg';
    const licenseMatch = /\.(\w+)$/.exec(licenseFilename);
    const licenseType = licenseMatch ? `image/${licenseMatch[1]}` : 'image/jpeg';

    formData.append('license', {
      uri: data.licenseUri,
      name: licenseFilename,
      type: licenseType,
    });

    // Selfie
    const selfieFilename = data.selfieUri.split('/').pop() || 'selfie.jpg';
    const selfieMatch = /\.(\w+)$/.exec(selfieFilename);
    const selfieType = selfieMatch ? `image/${selfieMatch[1]}` : 'image/jpeg';

    formData.append('selfie', {
      uri: data.selfieUri,
      name: selfieFilename,
      type: selfieType,
    });

    const response = await axios.post(
      `${API_URL}/verification/complete`,
      formData,
      {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 1500000,
      }
    );

    return response.data;
  } catch (error) {
    console.error('❌ Complete verification error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.message || 'Verification failed',
    };
  }
};

/**
 * Récupérer le statut de vérification
 */
export const getVerificationStatus = async (userId, manualToken = null) => {
  try {
    const headers = await getAuthHeaders(manualToken);
    const response = await axios.get(
      `${API_URL}/verification/status/${userId}`,
      { headers }
    );
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
};

/**
 * Health check des microservices
 */
export const checkServicesHealth = async () => {
  try {
    const response = await axios.get(`${API_URL}/verification/health`);
    return {
      success: true,
      allHealthy: response.data.allHealthy,
      services: response.data.services,
    };
  } catch (_error) {
    return { success: false };
  }
};
