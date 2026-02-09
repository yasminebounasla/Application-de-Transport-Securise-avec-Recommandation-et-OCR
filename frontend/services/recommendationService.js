import axios from "axios";
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = "http://192.168.1.69:5000/api";  

export const recommendDrivers = async (passengerId, preferences) => {
  try {
  
    // Récupérer le token
    const token = await AsyncStorage.getItem('token');
    
    const response = await axios.post(
      `${API_URL}/driver/recommendations`,
      {
        passenger_id: passengerId,
        preferences: preferences
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
    
    console.error(" Erreur recommandations:", {
      message: error.message
    });
    throw error;
  }
};