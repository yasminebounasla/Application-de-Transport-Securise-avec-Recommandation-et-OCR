import axios from "axios";
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = "http://192.168.1.69:5000/api";  

// POST feedback
export const submitFeedback = async (feedback) => {
  try {
    const token = await AsyncStorage.getItem('token');

    const response = await axios.post(
      `${API_URL}/feedback/submit`,
      {
        trajetId: feedback.trajetId,
        rating: feedback.rating,
        comment: feedback.comment
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        timeout: 30000
      }
    );

    return response.data;
  } catch (error) {
    console.error("Erreur submitFeedback :", error.message);
    throw error;
  }
};

// GET driver rating
export const getDriverRating = async (driverId) => {
  try {
    const token = await AsyncStorage.getItem('token');

    const response = await axios.get(
      `${API_URL}/drivers/${driverId}/rating`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        timeout: 30000
      }
    );

    return response.data;
  } catch (error) {
    console.error("Erreur getDriverRating :", error.message);
    throw error;
  }
};