import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const normalizeUrl = (value) => value?.trim().replace(/\/+$/, '');

export const API_URL = normalizeUrl(process.env.EXPO_PUBLIC_API_URL) || 'http://10.0.2.2:4040/api';

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

    console.log('?? Token:', token ? token.substring(0, 30) + '...' : 'ABSENT');
    console.log('?? Base URL:', config.baseURL);
    console.log('?? URL called:', config.url);

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
