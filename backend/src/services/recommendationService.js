import axios from 'axios';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5000/recommend";

export const getRecommendations = async (userId, preferences) => {
  try {
    const response = await axios.post(ML_SERVICE_URL, {
        user_id: userId,
        preferences: preferences
    });

    return response.data.recommendations;
  } catch (error) {

    console.error("Error fetching recommendations:", error);
    throw error;
  }
};