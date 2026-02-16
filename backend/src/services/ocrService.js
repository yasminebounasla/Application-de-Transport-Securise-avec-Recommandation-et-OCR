import axios from 'axios';
import FormData from 'form-data';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8001';

export async function extractLicenseData(imageBuffer, filename = 'license.jpg') {
  try {
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename,
      contentType: 'image/jpeg',
    });

    const { data } = await axios.post(
      `${OCR_SERVICE_URL}/extract`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 1300000,
      }
    );

    if (data.success) {
              const extractedData = data.data || data; // Fallback to data if nested structure not present

      return {
        success: true,
        data: {
          nin: extractedData.nin || null,
          issueDate: extractedData.issue_date || null,
          expiryDate: extractedData.expiry_date || null,
          confidence: extractedData.confidence || 0,
          fullText: extractedData.full_text || '',
        }
      };
    }

    return {
      success: false,
      error: data.error || 'OCR extraction failed'
    };
  } catch (error) {
    console.error('OCR Service Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'OCR service is not available. Please try again later.'
      };
    }

    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Unknown OCR error'
    };
  }
}

export async function healthCheck() {
  try {
    const response = await axios.get(`${OCR_SERVICE_URL}/health`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    console.error('OCR service health check failed:', error.message);
    return false;
  }
}