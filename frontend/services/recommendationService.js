import axios from "axios";
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const recommendDrivers = async (passengerId, preferences, trajet = {}, top_n = 5) => {
  try {
    const token = await AsyncStorage.getItem('token');
    
    const response = await axios.post(
      `${API_URL}/driver/recommendations`,
      {
        passenger_id: passengerId,
        preferences:  preferences,
        trajet:       trajet,    // ✅ ajout
        top_n:        top_n || 5,     // ✅ ajout
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
    console.error("Erreur recommandations:", { message: error.message });
    throw error;
  }
};