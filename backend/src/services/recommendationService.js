import axios from "axios";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

export const getRecommendations = async (passenger_id, preferences) => {
   console.log("ML_SERVICE_URL:", ML_SERVICE_URL);
  try {
    
    //connexion au service de recommandation ML
    const response = await axios.post(
      `${ML_SERVICE_URL}/recommend`, 
      {
        passenger_id: passenger_id,
        preferences: preferences || {},
        top_n: 10
      },
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.recommendations || [];
    
  } catch (error) {

    console.error("Erreur service ML:", {
      message: error.message
    });
    
    return [];
  }
};