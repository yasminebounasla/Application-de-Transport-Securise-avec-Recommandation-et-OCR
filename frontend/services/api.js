import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use your machine IP and backend port (backend uses PORT 4040 by default)
export const API_URL = 'http://192.168.1.41:4040/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    
    // 🔍 DIAGNOSTIC
    console.log('🔑 Token:', token ? token.substring(0, 30) + '...' : 'ABSENT ❌');
    console.log('📤 URL appelée:', config.url);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;