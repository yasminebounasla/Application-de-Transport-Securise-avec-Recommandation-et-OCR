import axios from 'axios';

PORT = process.env.PORT || 5000;
const ML_SERVICE_URL = "http://localhost:{port}/recommend".replace("{port}", PORT);

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