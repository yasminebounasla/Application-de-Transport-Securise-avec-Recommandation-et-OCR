import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { ToastData } from '../components/NotifToast';
import { API_URL } from '../services/api';
import FeedbackModal from '../components/FeedbackModal';

const SOCKET_URL = (process.env.EXPO_PUBLIC_API_URL_SANS_API?.trim() || API_URL.replace(/\/api$/, ''));

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
  type?: string;
};

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  socket: Socket | null;
  currentToast: ToastData | null;
  clearNotifications: () => void;
  markAsRead: (notif: Notification) => Promise<void>;
  markAllAsRead: () => void;
  hideToast: () => void;
  openFeedbackModal: (trajetId: number) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const CATEGORY_TOAST = (title: string): { color: string; icon: any } => {
  const t = title.toLowerCase();
  if (t.includes('confirme') || t.includes('accepte')) return { color: '#22C55E', icon: 'checkmark-circle' };
  if (t.includes('refus') || t.includes('annule') || t.includes('expiree')) return { color: '#EF4444', icon: 'close-circle' };
  if (t.includes('envoyee') || t.includes('cree') || t.includes('demande')) return { color: '#3B82F6', icon: 'car' };
  if (t.includes('avis')) return { color: '#F59E0B', icon: 'star' };
  return { color: '#8B5CF6', icon: 'notifications' };
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [socket, setSocket]               = useState<Socket | null>(null);
  const [currentToast, setCurrentToast]   = useState<ToastData | null>(null);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackTrajetId, setFeedbackTrajetId]         = useState<number | null>(null);
  const { user } = useAuth();

  const storageKey = user?.id ? `app_notifications_${user.id}` : null;
  const unreadKey  = user?.id ? `app_notifications_${user.id}_unread` : null;

  // ── 1. Load from cache ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setNotifications([]); setUnreadCount(0); return; }
    const load = async () => {
      if (!storageKey || !unreadKey) return;
      try {
        const cached = await AsyncStorage.getItem(storageKey);
        const unread = await AsyncStorage.getItem(unreadKey);
        const count  = unread ? parseInt(unread) : 0;
        if (cached) {
          const parsed: Notification[] = JSON.parse(cached);
          const normalized = parsed.map((n, i) => {
            const hasIsRead = typeof n.isRead === 'boolean';
            return { ...n, isRead: hasIsRead ? n.isRead : i < count ? false : true };
          });
          setNotifications(normalized);
          setUnreadCount(normalized.filter((n) => n.isRead === false).length);
          return;
        }
        setUnreadCount(count);
      } catch (e) { console.error('Cache load error:', e); }
    };
    load();
  }, [user?.id, storageKey]);

  // ── 2. Sync from DB ─────────────────────────────────────────────────────────
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
        const normalized: Notification[] = data.map((n: any) => ({
          id:        n.id,
          title:     n.title,
          message:   n.message,
          timestamp: new Date(n.createdAt).getTime(),
          isRead:    !!n.isRead,
          rideId:    n.data?.rideId,
          photoUrl:  n.data?.passenger?.photoUrl || n.data?.driver?.photoUrl || n.data?.photoUrl,
          prenom:    n.data?.passenger?.prenom || n.data?.driver?.prenom,
          nom:       n.data?.passenger?.nom    || n.data?.driver?.nom,
          type:      n.type,
        }));
        setNotifications((prev) => {
          const socketOnly = prev.filter(n => !n.id && n.isRead === false);
          const merged = [...socketOnly, ...normalized];
          const mergedUnread = merged.filter((n) => n.isRead === false).length;
          AsyncStorage.setItem(storageKey, JSON.stringify(merged));
          AsyncStorage.setItem(unreadKey, String(mergedUnread));
          setUnreadCount(mergedUnread);
          return merged;
        });
      }
    } catch (e) { console.error('fetchFromDB error:', e); }
  }, [user?.id, storageKey, unreadKey]);

  useEffect(() => { if (user?.id) fetchFromDB(); }, [user?.id]);

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
      if (unreadKey) AsyncStorage.setItem(unreadKey, String(next));
      return next;
    });
    const { color, icon } = CATEGORY_TOAST(title);
    setCurrentToast({ title, message, color, icon });
  }, [storageKey, unreadKey]);

  // ← helper: remove notifs by rideId + recount unread
  const removeNotifsByRideId = useCallback((rideId: number) => {
    setNotifications(prev => {
      const updated  = prev.filter(n => n.rideId !== rideId);
      const newUnread = updated.filter(n => n.isRead === false).length;
      if (storageKey) AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      if (unreadKey)  AsyncStorage.setItem(unreadKey, String(newUnread));
      setUnreadCount(newUnread);
      return updated;
    });
  }, [storageKey, unreadKey]);

  const markAllAsRead = useCallback(async () => {
    setUnreadCount(0);
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, isRead: true }));
      if (storageKey) AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
    if (unreadKey) await AsyncStorage.setItem(unreadKey, '0');
    try {
      const token = await AsyncStorage.getItem('token');
      fetch(`${API_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch (e) { console.error(e); }
  }, [storageKey, unreadKey]);

  const markAsRead = useCallback(async (notif: Notification) => {
    if (notif.isRead !== false) return;
    setNotifications((prev) => {
      const updated = prev.map((n) => {
        if (notif.id && n.id === notif.id) return { ...n, isRead: true };
        if (!notif.id && n.timestamp === notif.timestamp && n.title === notif.title) return { ...n, isRead: true };
        return n;
      });
      if (storageKey) AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
    setUnreadCount((prev) => {
      const next = Math.max(0, prev - 1);
      if (unreadKey) AsyncStorage.setItem(unreadKey, String(next));
      return next;
    });
    if (!notif.id) return;
    try {
      const token = await AsyncStorage.getItem('token');
      await fetch(`${API_URL}/notifications/${notif.id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch (e) {
      console.error('markAsRead error:', e);
    }
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
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch (e) { console.error(e); }
  };

  // ── 4. Socket.IO ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const newSocket = io(SOCKET_URL, { transports: ['websocket'], reconnection: true });

    newSocket.on('connect', () => {
      if (user.role === 'passenger') newSocket.emit('registerUser', user.id);
      else if (user.role === 'driver') newSocket.emit('registerDriver', user.id);
    });

    newSocket.on('reconnect', () => {
      if (user.role === 'passenger') newSocket.emit('registerUser', user.id);
      else if (user.role === 'driver') newSocket.emit('registerDriver', user.id);
    });

    // ← pour TOUS — quand un ride est pris, supprimer ses notifs pending
    newSocket.on('rideTaken', ({ rideId }: { rideId: number }) => {
      removeNotifsByRideId(rideId);
    });

    if (user.role === 'passenger') {
      newSocket.on('rideAccepted', (data) => {
        addNotif(data.title || 'Trajet confirmé', data.message, {
          rideId: data.rideId, type: 'RIDE_ACCEPTED',
          prenom: data.driver?.prenom, nom: data.driver?.nom,
          photoUrl: data.driver?.photoUrl,
        });
      });
      newSocket.on('rideRejectedByDriver', (data) => {
        addNotif(data.title || 'Demande refusée', data.message, {
          rideId: data.rideId, type: 'RIDE_REJECTED',
          prenom: data.driver?.prenom, nom: data.driver?.nom,
          photoUrl: data.driver?.photoUrl,
        });
      });
      newSocket.on('rideStarted', (data) => {
        addNotif(data.title || 'Trajet démarré', data.message, {
          rideId: data.rideId, type: 'RIDE_STARTED',
          prenom: data.driver?.prenom, nom: data.driver?.nom,
          photoUrl: data.driver?.photoUrl,
        });
      });
      newSocket.on('rideCompleted', (data) => {
        addNotif(data.title || 'Trajet terminé', data.message, {
          rideId: data.rideId, type: 'RIDE_COMPLETED',
        });
      });
    }

    if (user.role === 'driver') {
      newSocket.on('rideRequest', (data) => {
        addNotif(data.title || '🚗 Nouvelle demande', data.message, {
          rideId: data.rideId, type: 'RIDE_REQUEST',
          prenom: data.passenger?.prenom, nom: data.passenger?.nom,
          photoUrl: data.passenger?.photoUrl,
        });
      });
      newSocket.on('rideCancelledByPassenger', (data) => {
        addNotif(data.title || '❌ Trajet annulé', data.message, {
          rideId: data.rideId, type: 'RIDE_CANCELLED',
          prenom: data.passenger?.prenom, nom: data.passenger?.nom,
          photoUrl: data.passenger?.photoUrl,
        });
      });
      newSocket.on('newFeedback', (data) => {
        addNotif(data.title || '⭐ Nouvel avis reçu', data.message, {
          rideId: data.trajetId, type: 'NEW_FEEDBACK',
          prenom: data.passenger?.prenom,
          nom: data.passenger?.nom,
          photoUrl: data.passenger?.photoUrl,
        });
      });
    }

    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, [user?.id, user?.role, addNotif, removeNotifsByRideId]);

  const openFeedbackModal = (trajetId: number) => {
    setFeedbackTrajetId(trajetId);
    setFeedbackModalVisible(true);
  };

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, socket, currentToast,
      clearNotifications, markAsRead, markAllAsRead,
      hideToast: () => setCurrentToast(null),
      openFeedbackModal,
    }}>
      {children}
      <FeedbackModal
        visible={feedbackModalVisible}
        trajetId={feedbackTrajetId}
        onClose={() => { setFeedbackModalVisible(false); setFeedbackTrajetId(null); }}
      />
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
