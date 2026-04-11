import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const normalizeUrl = (value) => value?.trim().replace(/\/+$/, '');

export const API_URL = normalizeUrl(process.env.EXPO_PUBLIC_API_URL) || 'http://192.168.1.70:4040/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 90000,
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
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = await AsyncStorage.getItem('refreshToken');
                const userType = await AsyncStorage.getItem('userType');

                const { data } = await axios.post(
                    `${API_URL}/auth/${userType}/refresh`,
                    { refreshToken }
                );

                await AsyncStorage.setItem('token', data.accessToken);
                originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
                return api(originalRequest);

            } catch (refreshError) {
                await AsyncStorage.multiRemove(['token', 'refreshToken', 'userType', 'user']);
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default api;
