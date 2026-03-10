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
          // ✅ Le cache contient déjà le bon isRead (sauvegardé par markAllAsRead)
          setNotifications(JSON.parse(cached));
          setUnreadCount(unread ? parseInt(unread) : 0);
        }
      } catch (e) {
        console.error("Erreur cache local:", e);
      }
    };

    loadLocalCache();
  }, [user?.id, storageKey]);

  // ── 2. Sync BD — appelé UNE SEULE FOIS au login, pas au focus ──────────────
  // ✅ FIX PRINCIPAL : fetchFromDB est appelé uniquement quand user.id change
  // (login/logout), jamais au focus de l'écran notifs.
  // Résultat : isRead en mémoire locale fait foi, pas la BD.
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
          isRead:    n.isRead,  // valeur BD
          rideId:    n.data?.rideId,
          prenom:    n.data?.passenger?.prenom || n.data?.driver?.prenom,
          nom:       n.data?.passenger?.nom    || n.data?.driver?.nom,
        }));

        // ✅ FIX : merge avec le cache local existant
        // Si une notif est isRead=false dans le cache local → on garde false
        // même si la BD dit true (cas : notif reçue par socket avant fetchFromDB)
        const cachedRaw = await AsyncStorage.getItem(storageKey);
        const cached: Notification[] = cachedRaw ? JSON.parse(cachedRaw) : [];
        const localUnreadIds = new Set(
          cached.filter(n => n.isRead === false && n.id).map(n => n.id)
        );

        const merged = normalized.map(n => ({
          ...n,
          isRead: localUnreadIds.has(n.id) ? false : n.isRead,
        }));

        // unreadCount : max entre serveur et cache local
        const localUnread = parseInt(await AsyncStorage.getItem(`${storageKey}_unread`) || '0');
        const finalUnread = Math.max(serverUnread, localUnread);

        setNotifications(merged);
        setUnreadCount(finalUnread);
        await AsyncStorage.setItem(storageKey, JSON.stringify(merged));
        await AsyncStorage.setItem(`${storageKey}_unread`, String(finalUnread));
      }
    } catch (e) {
      console.error('Erreur fetch DB notifications:', e);
    }
  }, [user?.id, storageKey]);

  // ✅ Appel UNIQUEMENT au login (user.id change), jamais au focus
  useEffect(() => {
    if (user?.id) fetchFromDB();
  }, [user?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

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

  const markAllAsRead = useCallback(async () => {
    // ✅ FIX : mettre isRead=true en mémoire ET dans le cache local
    // On capture les notifs actuelles pour les sauvegarder correctement
    setUnreadCount(0);
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, isRead: true }));
      // Sauvegarder le cache avec isRead=true
      if (storageKey) AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
    if (storageKey) await AsyncStorage.setItem(`${storageKey}_unread`, '0');

    // Appel BD en arrière-plan (non bloquant)
    try {
      const token = await AsyncStorage.getItem('token');
      fetch(`${API_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch (e) { console.error(e); }
  }, [storageKey]);

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
        addNotif(data.title || '❌ Trajet annulé', data.message || `${data.passenger?.prenom} a annulé le trajet.`, { rideId: data.rideId, prenom: data.passenger?.prenom, nom: data.passenger?.nom });
      });
      newSocket.on('newFeedback', (data) => {
        addNotif(data.title || '⭐ Nouvel avis reçu', data.message || `${data.passengerName} vous a donné une note.`, { rideId: data.trajetId });
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