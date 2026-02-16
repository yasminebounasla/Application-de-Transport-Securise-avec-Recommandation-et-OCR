import axios from 'axios';
import FormData from 'form-data';
import { Readable } from 'node:stream';

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://localhost:8002';

/**
 * Convertit un Buffer en Stream lisible
 * WORKAROUND pour éviter les bugs de form-data avec les Buffers
 */
function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null); // Signal de fin
  return stream;
}

/**
 * Compare le selfie avec l'image du permis
 */
export async function compareFaces(licenseBuffer, selfieBuffer) {
  try {
    const formData = new FormData();

    // Convertir les Buffers en Streams
    formData.append('license_image', bufferToStream(licenseBuffer), {
      filename: 'license.jpg',
      contentType: 'image/jpeg',
      knownLength: licenseBuffer.length,
    });

    formData.append('selfie_image', bufferToStream(selfieBuffer), {
      filename: 'selfie.jpg',
      contentType: 'image/jpeg',
      knownLength: selfieBuffer.length,
    });

    console.log('📤 Sending face comparison request...');
    
    const { data } = await axios.post(
      `${FACE_SERVICE_URL}/compare`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 190000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    console.log('✅ Face comparison response received:', data);

    //  CORRECTION: Vérifie "verified", pas "success"
    if (data && data.verified !== undefined) {
      return {
        success: true,
        data: {
          verdict: data.verdict || (data.verified ? 'MATCH' : 'NO_MATCH'),  
          similarityScore: data.similarity, 
          threshold: data.threshold,
          margin: data.margin,
          confidence: data.confidence,
          licenseQuality: data.license_data?.quality_category || 'UNKNOWN',  
          selfieQuality: data.selfie_data?.quality_category || 'UNKNOWN'     
        }
      };
    }

    return {
      success: false,
      error: data.error || 'Face comparison failed'
    };
  } catch (error) {
    console.error('❌ Face Recognition Service Error:', error.message);
    console.error('Error details:', error.response?.data || error);
    
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'Face recognition service is not available. Please start the Python service on port 8002.'
      };
    }

    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Unknown face comparison error'
    };
  }
}


/**
 * Vérifie si le service Python est en ligne
 */
export async function healthCheck() {
  try {
    const { data } = await axios.get(`${FACE_SERVICE_URL}/health`, { timeout: 5000 });
    return data.status === 'healthy' || data.success === true;
  } catch (error) {
    return false;
  }
}