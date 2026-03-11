import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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

  const storageKey    = user?.id ? `app_notifications_${user.id}` : null;
  const unreadKey     = user?.id ? `app_notifications_${user.id}_unread` : null;

  // ── 1. Chargement au login ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    const load = async () => {
      if (!storageKey || !unreadKey) return;
      try {
        const cached = await AsyncStorage.getItem(storageKey);
        const unread = await AsyncStorage.getItem(unreadKey);
        // ✅ unreadCount depuis le cache — source de vérité pour le badge
        const count = unread ? parseInt(unread) : 0;
        if (cached) {
          const parsed: Notification[] = JSON.parse(cached);
          // ✅ FIX DEFINITIF : on remet isRead=false sur les N premières
          // selon le unreadCount sauvegardé — jamais perdu entre sessions
          const withCorrectRead = parsed.map((n, i) => ({
            ...n,
            isRead: i < count ? false : true,
          }));
          setNotifications(withCorrectRead);
        }
        setUnreadCount(count);
      } catch (e) { console.error('Cache load error:', e); }
    };
    load();
  }, [user?.id]);

  // ── 2. Fetch BD au login ────────────────────────────────────────────────────
  const fetchFromDB = useCallback(async (retryCount = 0) => {
    if (!user?.id || !storageKey || !unreadKey) return;
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
        const normalized: Notification[] = data.map((n: any, i: number) => ({
          id:        n.id,
          title:     n.title,
          message:   n.message,
          timestamp: new Date(n.createdAt).getTime(),
          // ✅ isRead basé sur la position ET serverUnread — pas sur n.isRead de la BD
          isRead:    i < serverUnread ? false : true,
          rideId:    n.data?.rideId,
          prenom:    n.data?.passenger?.prenom || n.data?.driver?.prenom,
          nom:       n.data?.passenger?.nom    || n.data?.driver?.nom,
        }));

        // Garder en mémoire les notifs socket non encore en BD (sans id)
        setNotifications(prev => {
          const socketOnlyNotifs = prev.filter(n => !n.id && n.isRead === false);
          const merged = [...socketOnlyNotifs, ...normalized];
          AsyncStorage.setItem(storageKey, JSON.stringify(merged));
          return merged;
        });

        setUnreadCount(serverUnread);
        await AsyncStorage.setItem(unreadKey, String(serverUnread));
      }
    } catch (e) { console.error('fetchFromDB error:', e); }
  }, [user?.id, storageKey, unreadKey]);

  useEffect(() => {
    if (user?.id) fetchFromDB();
  }, [user?.id]);

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
      // ✅ Sauvegarder le nouveau unreadCount immédiatement
      if (unreadKey) AsyncStorage.setItem(unreadKey, String(next));
      return next;
    });

    const { color, icon } = CATEGORY_TOAST(title);
    setCurrentToast({ title, message, color, icon });
  }, [storageKey, unreadKey]);

  const markAllAsRead = useCallback(async () => {
    setUnreadCount(0);
    // ✅ FIX : mettre isRead=true en mémoire
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, isRead: true }));
      if (storageKey) AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
    // ✅ Sauvegarder unreadCount=0 — clé du fix
    if (unreadKey) await AsyncStorage.setItem(unreadKey, '0');

    try {
      const token = await AsyncStorage.getItem('token');
      fetch(`${API_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch (e) { console.error(e); }
  }, [storageKey, unreadKey]);

  const clearNotifications = async () => {
    setNotifications([]);
    setUnreadCount(0);
    if (storageKey) await AsyncStorage.removeItem(storageKey);
    if (unreadKey)  await AsyncStorage.removeItem(unreadKey);
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
    const newSocket = io(SOCKET_URL, { transports: ['websocket'], reconnection: true });

    newSocket.on('connect', () => {
      console.log('🔌 Socket connecté:', newSocket.id);
      if (user.role === 'passenger') newSocket.emit('registerUser', user.id);
      else if (user.role === 'driver') newSocket.emit('registerDriver', user.id);
    });

    if (user.role === 'passenger') {
      newSocket.on('rideAccepted', (data) => {
        addNotif(data.title || '✅ Trajet confirmé', data.message || `${data.driver?.prenom} a accepté votre demande.`, { rideId: data.rideId, prenom: data.driver?.prenom, nom: data.driver?.nom });
      });
      newSocket.on('rideRejectedByDriver', (data) => {
        addNotif(data.title || '❌ Demande refusée', data.message || 'Votre demande a été refusée.', { rideId: data.rideId });
      });
      newSocket.on('rideStarted', (data) => {
        addNotif(data.title || '🚗 Trajet démarré', data.message || 'Votre trajet a démarré !', { rideId: data.rideId });
      });
      newSocket.on('rideCompleted', (data) => {
        addNotif(data.title || '🏁 Trajet terminé', data.message || 'Votre trajet est terminé.', { rideId: data.rideId });
      });
    }

    if (user.role === 'driver') {
      newSocket.on('rideRequest', (data) => {
        addNotif('🚗 Nouvelle demande', `${data.passenger?.prenom} sollicite un trajet`, { rideId: data.rideId, prenom: data.passenger?.prenom, nom: data.passenger?.nom });
      });
      newSocket.on('rideCancelledByPassenger', (data) => {
        addNotif(data.title || '❌ Trajet annulé', data.message || `${data.passenger?.prenom} a annulé.`, { rideId: data.rideId, prenom: data.passenger?.prenom, nom: data.passenger?.nom });
      });
      newSocket.on('newFeedback', (data) => {
        addNotif(data.title || '⭐ Nouvel avis reçu', data.message || `${data.passengerName} vous a noté.`, { rideId: data.trajetId });
      });
    }

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