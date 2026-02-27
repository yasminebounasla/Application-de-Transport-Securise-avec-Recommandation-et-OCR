import { io } from "socket.io-client";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './api';

// Helper to derive base socket URL from API_URL
const SOCKET_URL = API_URL.replace(/\/api$/, '');

let socket = null;

/**
 * Initialise ou retourne l'instance de socket connectée.
 * La fonction récupère le JWT stocké en AsyncStorage et l'ajoute
 * dans la payload d'auth lors de la connexion.
 * Usage typique dans un component:
 *   const socket = await initSocket();
 *   socket.emit('registerUser', userId);
 */
export const initSocket = async () => {
  if (socket && socket.connected) return socket;

  const token = await AsyncStorage.getItem('token');

  socket = io(SOCKET_URL, {
    auth: {
      token: token || '',
    },
    transports: ['websocket'],
    autoConnect: false,
  });

  socket.on('connect', () => {
    console.log('🔌 WebSocket connected:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.warn('⚠️ Socket connect error:', err.message);
  });

  // automatically attempt connection once configured
  socket.connect();

  return socket;
};

/**
 * Retourne l'instance de socket existante (ou null if not initialised).
 */
export const getSocket = () => socket;

/**
 * Déconnecte et efface l'instance de socket.
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
