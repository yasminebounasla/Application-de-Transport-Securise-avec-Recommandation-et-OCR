import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

type Notification = {
  title: string;
  message: string;
  timestamp: number;
};

type NotificationContextType = {
  notifications: Notification[];
  socket: Socket | null;
  clearNotifications: () => void;
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

  // ✅ Charger les notifs sauvegardées au démarrage
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setNotifications(JSON.parse(stored));
      } catch (error) {
        console.error('Erreur chargement notifications:', error);
      }
    };
    loadNotifications();
  }, []);

  const addNotif = async (title: string, message: string) => {
    const newNotif: Notification = { title, message, timestamp: Date.now() };
    setNotifications(prev => {
      const updated = [newNotif, ...prev];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(console.error);
      return updated;
    });
  };

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

        // Events UNIQUEMENT pour le passager
        newSocket.on('rideCreated', (data: any) => {
          addNotif(
            '🚗 Demande envoyée',
            "Votre demande de trajet a été soumise. En attente d'un conducteur."
          );
        });

        newSocket.on('rideAccepted', (data: any) => {
          addNotif(
            '✅ Trajet confirmé',
            `${data.driver.prenom} ${data.driver.nom ?? ''} a accepté votre trajet. Préparez-vous !`
          );
        });

        newSocket.on('rideRejectedByDriver', (data: any) => {
          addNotif(
            '❌ Demande non acceptée',
            'Votre demande n\'a pas pu être prise en charge. Veuillez en soumettre une nouvelle.'
          );
        });

      } else if (user.role === 'driver') {
        newSocket.emit('registerDriver', user.id);
        console.log('📢 Registered as driver:', user.id);

        // Events UNIQUEMENT pour le driver
        newSocket.on('rideCancelledByPassenger', (data: any) => {
          addNotif(
            '⚠️ Trajet annulé',
            `${data.passenger.prenom} ${data.passenger.nom ?? ''} a annulé sa demande de trajet.`
          );
        });

        newSocket.on('newFeedback', (data: any) => {
          const stars = '⭐'.repeat(data.rating);
          const message = data.comment
            ? `${data.passengerName} a évalué votre trajet : ${stars}\n"${data.comment}"`
            : `${data.passengerName} a évalué votre trajet : ${stars}`;
          
          addNotif('Nouvel avis reçu', message);
        });
      }
    });

    newSocket.on('connect_error', (err) => {
      console.log('❌ Erreur connexion socket:', err.message);
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