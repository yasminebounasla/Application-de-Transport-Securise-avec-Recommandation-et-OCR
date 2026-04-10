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

    if (token && token.trim() !== '' && token !== 'null' && token !== 'undefined') {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      await AsyncStorage.multiRemove(['token', 'user']);
    }

    return Promise.reject(error);
  }
);

export default api;
