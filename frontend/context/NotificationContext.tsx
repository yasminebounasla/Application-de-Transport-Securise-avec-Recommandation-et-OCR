import React, { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { ToastData } from '../components/NotifToast';
import { API_URL } from '../services/api';

const SOCKET_URL = (process.env.EXPO_PUBLIC_API_URL_SANS_API || API_URL.replace(/\/api$/, ''));

export type Notification = {
  id?: number;
  title: string;
  message: string;
  timestamp: number;
  isRead?: boolean;
  photoUrl?: string;
  prenom?: string;
  nom?: string;
  rideId?: number;
};

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  socket: Socket | null;
  currentToast: ToastData | null;
  clearNotifications: () => void;
  markAllAsRead: () => void;
  hideToast: () => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const CATEGORY_TOAST = (title: string): { color: string; icon: any } => {
  const t = title.toLowerCase();
  if (t.includes('confirmé') || t.includes('accepté')) return { color: '#22C55E', icon: 'checkmark-circle' };
  if (t.includes('refus') || t.includes('annulé') || t.includes('expirée')) return { color: '#EF4444', icon: 'close-circle' };
  if (t.includes('démarré')) return { color: '#3B82F6', icon: 'car' };
  if (t.includes('terminé')) return { color: '#8B5CF6', icon: 'flag' };
  if (t.includes('avis')) return { color: '#F59E0B', icon: 'star' };
  return { color: '#8B5CF6', icon: 'notifications' };
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentToast, setCurrentToast] = useState<ToastData | null>(null);
  const { user } = useAuth();

  const storageKey = user?.id ? `app_notifications_${user.id}` : null;

  // ── 1. Reset au logout + chargement cache au login ──────────────────────────
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const loadLocalCache = async () => {
      if (!storageKey) return;
      try {
        const cached = await AsyncStorage.getItem(storageKey);
        const unread = await AsyncStorage.getItem(`${storageKey}_unread`);
        if (cached) {
          setNotifications(JSON.parse(cached));
          setUnreadCount(unread ? parseInt(unread) : 0);
        }
      } catch (e) {
        console.error("Erreur cache local:", e);
      }
    };

    loadLocalCache();
  }, [user?.id, storageKey]);

  // ── 2. Sync avec la base de données ────────────────────────────────────────
  const fetchFromDB = useCallback(async (retryCount = 0) => {
    if (!user?.id || !storageKey) return;
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        if (retryCount < 3) setTimeout(() => fetchFromDB(retryCount + 1), 1000);
        return;
      }

      const response = await fetch(`${API_URL}/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const { data, unreadCount: serverUnread } = await response.json();
        const normalized: Notification[] = data.map((n: any) => ({
          id:        n.id,
          title:     n.title,
          message:   n.message,
          timestamp: new Date(n.createdAt).getTime(),
          isRead:    n.isRead,
          rideId:    n.data?.rideId,
          prenom:    n.data?.passenger?.prenom || n.data?.driver?.prenom,
          nom:       n.data?.passenger?.nom    || n.data?.driver?.nom,
        }));

        setNotifications(normalized);
        setUnreadCount(serverUnread);
        await AsyncStorage.setItem(storageKey, JSON.stringify(normalized));
        await AsyncStorage.setItem(`${storageKey}_unread`, String(serverUnread));
      }
    } catch (e) {
      console.error('Erreur fetch DB notifications:', e);
    }
  }, [user?.id, storageKey]);

  useEffect(() => {
    if (user?.id) fetchFromDB();
  }, [user?.id, fetchFromDB]);

  // ── 3. Actions ──────────────────────────────────────────────────────────────
  const addNotif = useCallback(async (title: string, message: string, extra?: Partial<Notification>) => {
    const newNotif: Notification = { title, message, timestamp: Date.now(), isRead: false, ...extra };

    setNotifications(prev => {
      const updated = [newNotif, ...prev];
      if (storageKey) AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });

    setUnreadCount(prev => {
      const next = prev + 1;
      if (storageKey) AsyncStorage.setItem(`${storageKey}_unread`, String(next));
      return next;
    });

    const { color, icon } = CATEGORY_TOAST(title);
    setCurrentToast({ title, message, color, icon });
  }, [storageKey]);

  const markAllAsRead = async () => {
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    if (storageKey) await AsyncStorage.setItem(`${storageKey}_unread`, '0');
    try {
      const token = await AsyncStorage.getItem('token');
      await fetch(`${API_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch (e) { console.error(e); }
  };

  const clearNotifications = async () => {
    setNotifications([]);
    setUnreadCount(0);
    if (storageKey) {
      await AsyncStorage.removeItem(storageKey);
      await AsyncStorage.removeItem(`${storageKey}_unread`);
    }
    try {
      const token = await AsyncStorage.getItem('token');
      await fetch(`${API_URL}/notifications`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) { console.error(e); }
  };

  // ── 4. Socket.IO ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
    });

    newSocket.on('connect', () => {
      console.log('🔌 Socket connecté:', newSocket.id);

      // ✅ FIX : enregistrement DANS le callback connect pour garantir
      //          que le socket est bien connecté avant d'émettre
      if (user.role === 'passenger') {
        newSocket.emit('registerUser', user.id);
      } else if (user.role === 'driver') {
        newSocket.emit('registerDriver', user.id);
      }
    });

    // ── Events PASSAGER ──────────────────────────────────────────────────────
    if (user.role === 'passenger') {
      newSocket.on('rideAccepted', (data) => {
        addNotif(
          data.title || '✅ Trajet confirmé',
          data.message || `${data.driver?.prenom} a accepté votre demande de trajet.`,
          { rideId: data.rideId, prenom: data.driver?.prenom, nom: data.driver?.nom }
        );
      });

      // ✅ FIX : écouter le refus de trajet par le driver
      newSocket.on('rideRejectedByDriver', (data) => {
        addNotif(
          data.title || '❌ Demande refusée',
          data.message || 'Votre demande de trajet a été refusée.',
          { rideId: data.rideId }
        );
      });

      // ✅ FIX : écouter le démarrage du trajet
      newSocket.on('rideStarted', (data) => {
        addNotif(
          data.title || '🚗 Trajet démarré',
          data.message || 'Votre trajet a démarré !',
          { rideId: data.rideId }
        );
      });

      // ✅ FIX : écouter la fin du trajet
      newSocket.on('rideCompleted', (data) => {
        addNotif(
          data.title || '🏁 Trajet terminé',
          data.message || 'Votre trajet est terminé.',
          { rideId: data.rideId }
        );
      });
    }

    // ── Events DRIVER ────────────────────────────────────────────────────────
    if (user.role === 'driver') {
      newSocket.on('rideRequest', (data) => {
        addNotif(
          '🚗 Nouvelle demande',
          `${data.passenger?.prenom} sollicite un trajet`,
          { rideId: data.rideId, prenom: data.passenger?.prenom, nom: data.passenger?.nom }
        );
      });

      // ✅ FIX : écouter l'annulation par le passager
      newSocket.on('rideCancelledByPassenger', (data) => {
        addNotif(
          data.title || '❌ Trajet annulé',
          data.message || `${data.passenger?.prenom} a annulé le trajet.`,
          { rideId: data.rideId, prenom: data.passenger?.prenom, nom: data.passenger?.nom }
        );
      });

      // ✅ FIX : écouter les nouveaux avis
      newSocket.on('newFeedback', (data) => {
        addNotif(
          data.title || '⭐ Nouvel avis reçu',
          data.message || `${data.passengerName} vous a donné une note.`,
          { rideId: data.trajetId }
        );
      });
    }

    // ✅ FIX : re-register si reconnexion automatique
    newSocket.on('reconnect', () => {
      if (user.role === 'passenger') newSocket.emit('registerUser', user.id);
      else if (user.role === 'driver') newSocket.emit('registerDriver', user.id);
    });

    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, [user?.id, user?.role, addNotif]);

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, socket, currentToast,
      clearNotifications, markAllAsRead, hideToast: () => setCurrentToast(null)
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
};