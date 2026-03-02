import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

type Notification = {
  title: string;
  message: string;
  timestamp: number;
  photoUrl?: string;
  prenom?: string;
  nom?: string;
};

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  socket: Socket | null;
  clearNotifications: () => void;
  markAllAsRead: () => void;
};

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  socket: null,
  clearNotifications: () => {},
  markAllAsRead: () => {},
});

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { user } = useAuth();

  const storageKey = user?.id ? `app_notifications_${user.id}` : null;
  const storageKeyRef = useRef(storageKey);
  useEffect(() => { storageKeyRef.current = storageKey; }, [storageKey]);

  // ✅ Charger notifs + unreadCount au démarrage
  useEffect(() => {
    if (!storageKey) return;
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        const unread = await AsyncStorage.getItem(`${storageKey}_unread`);
        if (stored) setNotifications(JSON.parse(stored));
        else setNotifications([]);
        if (unread) setUnreadCount(parseInt(unread));
        else setUnreadCount(0);
      } catch (e) {
        console.error('Erreur chargement notifications:', e);
      }
    };
    load();
  }, [storageKey]);

  const addNotif = useRef(async (title: string, message: string, extra?: Partial<Notification>) => {
    const key = storageKeyRef.current;
    if (!key) return;
    const newNotif: Notification = { title, message, timestamp: Date.now(), ...extra };
    setNotifications(prev => {
      const updated = [newNotif, ...prev];
      AsyncStorage.setItem(key, JSON.stringify(updated)).catch(console.error);
      return updated;
    });
    setUnreadCount(prev => {
      const next = prev + 1;
      AsyncStorage.setItem(`${key}_unread`, String(next)).catch(console.error);
      return next;
    });
  });

  // ✅ Efface tout
  const clearNotifications = async () => {
    if (!storageKey) return;
    setNotifications([]);
    setUnreadCount(0);
    await AsyncStorage.removeItem(storageKey);
    await AsyncStorage.removeItem(`${storageKey}_unread`);
  };

  // ✅ Juste reset le badge (marquer comme lu) sans supprimer
  const markAllAsRead = async () => {
    if (!storageKey) return;
    setUnreadCount(0);
    await AsyncStorage.setItem(`${storageKey}_unread`, '0');
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

        newSocket.on('rideCreated', () => {
          addNotif.current('🚗 Demande envoyée', "Votre demande de trajet a été soumise. En attente d'un conducteur.");
        });

        newSocket.on('rideAccepted', (data: any) => {
          addNotif.current(
            '✅ Trajet confirmé',
            `${data.driver.prenom} ${data.driver.nom ?? ''} a accepté votre trajet.`,
            { prenom: data.driver.prenom, nom: data.driver.nom, photoUrl: data.driver.photoUrl }
          );
        });

        newSocket.on('rideRejectedByDriver', () => {
          addNotif.current('❌ Demande non acceptée', "Votre demande n'a pas pu être prise en charge.");
        });

      } else if (user.role === 'driver') {
        newSocket.emit('registerDriver', user.id);

        newSocket.on('rideCancelledByPassenger', (data: any) => {
          addNotif.current(
            '⚠️ Trajet annulé',
            `${data.passenger.prenom} ${data.passenger.nom ?? ''} a annulé sa demande.`,
            { prenom: data.passenger.prenom, nom: data.passenger.nom }
          );
        });

        newSocket.on('newFeedback', (data: any) => {
          const stars = '⭐'.repeat(data.rating);
          const message = data.comment
            ? `${data.passengerName} a évalué votre trajet : ${stars}\n"${data.comment}"`
            : `${data.passengerName} a évalué votre trajet : ${stars}`;
          addNotif.current('⭐ Nouvel avis reçu', message);
        });
      }
    });

    newSocket.on('connect_error', (err) => console.log('❌ Erreur socket:', err.message));
    newSocket.on('disconnect', () => console.log('❌ Socket déconnecté'));

    return () => { newSocket.disconnect(); };
  }, [user]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, socket, clearNotifications, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);