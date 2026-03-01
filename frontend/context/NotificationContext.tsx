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

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { user } = useAuth();

  // ✅ Clé unique par user — plus de partage entre users
  const storageKey = user?.id ? `app_notifications_${user.id}` : null;

  // ✅ Charger les notifs au démarrage — seulement si user connecté
  useEffect(() => {
    if (!storageKey) return;

    const loadNotifications = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) setNotifications(JSON.parse(stored));
        else setNotifications([]); // ✅ reset si nouveau user
      } catch (error) {
        console.error('Erreur chargement notifications:', error);
      }
    };
    loadNotifications();
  }, [storageKey]); // ✅ se relance si user change

  const addNotif = async (title: string, message: string) => {
    if (!storageKey) return;
    const newNotif: Notification = { title, message, timestamp: Date.now() };
    setNotifications(prev => {
      const updated = [newNotif, ...prev];
      AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(console.error);
      return updated;
    });
  };

  const clearNotifications = async () => {
    if (!storageKey) return;
    setNotifications([]);
    await AsyncStorage.removeItem(storageKey);
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
            "Votre demande n'a pas pu être prise en charge. Veuillez en soumettre une nouvelle."
          );
        });

      } else if (user.role === 'driver') {
        newSocket.emit('registerDriver', user.id);
        console.log('📢 Registered as driver:', user.id);

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
          addNotif('⭐ Nouvel avis reçu', message);
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