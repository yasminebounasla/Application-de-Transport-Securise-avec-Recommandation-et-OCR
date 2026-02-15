import axios from "axios";
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = "http://192.168.1.69:5000/api";  

// pour les passagers :

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

// GET feedback by trajetId
export const getFeedbackByTrajet = async (trajetId) => {
  try {
    const token = await AsyncStorage.getItem('token');

    const response = await axios.get(
      `${API_URL}/feedback/trajet/${trajetId}`,
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
    console.error("Erreur getFeedbackByTrajet :", error.message);
    throw error;
  }
};

// GET public start d'un driver
export const getPublicDriverStats = async (driverId) => {
  try {
    const token = await AsyncStorage.getItem('token');

    const response = await axios.get(
      `${API_URL}/feedback/driver/${driverId}/stats`,
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
    console.error("Erreur getPublicDriverStats :", error.message);
    throw error;
  }
};

// GET feedbacks publics d'un driver
export const getPublicDriverFeedback = async (driverId) => {
  try {
    const token = await AsyncStorage.getItem('token');

    const response = await axios.get(
      `${API_URL}/feedback/driver/${driverId}/public`,
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
    console.error("Erreur getPublicDriverFeedback :", error.message);
    throw error;
  }
};



// pour les drivers :


// GET stats d'un driver 
export const getDriverStats = async () => {
  try {
    const token = await AsyncStorage.getItem('token');

    const response = await axios.get(
      `${API_URL}/feedback/my-stats`,
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
    console.error("Erreur getPublicDriverFeedback :", error.message);
    throw error;
  }
};


export const getDriverFeedback = async () => {
  try {
    const token = await AsyncStorage.getItem('token');

    const response = await axios.get(
      `${API_URL}/feedback/my-feedbacks`,
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
    console.error("Erreur getPublicDriverFeedback :", error.message);
    throw error;
  }
};



