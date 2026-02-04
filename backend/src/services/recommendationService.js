import axios from 'axios';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000/recommend";  // ← Enlève le ; si présent

export const getRecommendations = async (passenger_id, preferences) => {
  try {
    console.log("Sending to ML:", { passenger_id, preferences });
    
    const response = await axios.post(ML_SERVICE_URL, {
      passenger_id: passenger_id,
      preferences: preferences || {}
    });
    
    return response.data.recommendations;
  } catch (error) {
    console.error("Error fetching recommendations:", error.response?.data || error.message);
    throw error;
  }
};