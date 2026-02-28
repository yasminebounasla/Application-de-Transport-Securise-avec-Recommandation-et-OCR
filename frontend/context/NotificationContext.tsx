import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

type Notification = {
  title: string;
  message: string;
  timestamp: number; // ✅ pour trier par date
};

type NotificationContextType = {
  notifications: Notification[];
  socket: Socket | null;
  clearNotifications: () => void; // ✅ pour vider si besoin
};

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  socket: null,
  clearNotifications: () => {},
});

const STORAGE_KEY = 'app_notifications';

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { user } = useAuth();

  // Charger les notifs sauvegardées au démarrage
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setNotifications(JSON.parse(stored));
          console.log('📥 Notifications chargées depuis le stockage');
        }
      } catch (error) {
        console.error('Erreur chargement notifications:', error);
      }
    };
    loadNotifications();
  }, []);

  // Sauvegarder dans AsyncStorage à chaque nouvelle notif
  const addNotif = async (title: string, message: string) => {
    const newNotif: Notification = {
      title,
      message,
      timestamp: Date.now(),
    };

    setNotifications(prev => {
      const updated = [newNotif, ...prev];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(console.error);
      return updated;
    });
  };

  // Vider toutes les notifications
  const clearNotifications = async () => {
    setNotifications([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  useEffect(() => {
    if (!user || !user.id) return;

    const newSocket = io(process.env.EXPO_PUBLIC_API_URL_SANS_API!, {
      transports: ['websocket'],
      reconnection: true,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ Connecté à Socket.IO:', newSocket.id);

      if (user.role === 'passenger') {
        newSocket.emit('registerUser', user.id);
        console.log('📢 Registered as passenger:', user.id);
      } else if (user.role === 'driver') {
        newSocket.emit('registerDriver', user.id);
        console.log('📢 Registered as driver:', user.id);
      }
    });

    newSocket.on('connect_error', (err) => {
      console.log('❌ Erreur connexion socket:', err.message);
    });

    // Events PASSAGER 
    newSocket.on('rideCreated', (data: any) => {
      addNotif(
        '🚗 Demande envoyée',
        'Votre demande de trajet a été soumise avec succès. En attente de confirmation d\'un conducteur.'
      );
    });

    newSocket.on('rideAccepted', (data: any) => {
      addNotif(
        '✅ Trajet confirmé',
        `Votre trajet a été accepté par ${data.driver.prenom} ${data.driver.nom ?? ''}. Préparez-vous, il arrive bientôt.`
      );
    });

    newSocket.on('rideRejectedByDriver', (data: any) => {
      addNotif(
        '❌ Demande non acceptée',
        'Votre demande de trajet n\'a pas pu être prise en charge. Veuillez soumettre une nouvelle demande.'
      );
    });

    // Events DRIVER 
    newSocket.on('rideCancelledByPassenger', (data: any) => {
      addNotif(
        '⚠️ Trajet annulé',
        `Le passager ${data.passenger.prenom} ${data.passenger.nom ?? ''} a annulé sa demande de trajet.`
      );
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Socket déconnecté');
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <NotificationContext.Provider value={{ notifications, socket, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);