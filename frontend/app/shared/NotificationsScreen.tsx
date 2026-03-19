import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Image, ActivityIndicator,
} from 'react-native';
import { Stack, useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

type Notification = {
  title: string;
  message: string;
  timestamp?: number;
  isRead?: boolean;
  photoUrl?: string;
  prenom?: string;
  nom?: string;
  rideId?: number;
  type?: string;
};

const getRelativeTime = (timestamp: number) => {
  const diff  = Date.now() - timestamp;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

// Neutral, simple avatar accent colors — one per type
const TYPE_CONFIG: Record<string, { accent: string; icon: any; label: string }> = {
  RIDE_ACCEPTED:  { accent: '#4CAF50', icon: 'checkmark-circle-outline', label: 'Accepted'  },
  RIDE_REJECTED:  { accent: '#F44336', icon: 'close-circle-outline',     label: 'Rejected'  },
  RIDE_CANCELLED: { accent: '#F44336', icon: 'ban-outline',              label: 'Cancelled' },
  RIDE_STARTED:   { accent: '#2196F3', icon: 'navigate-outline',         label: 'Started'   },
  RIDE_COMPLETED: { accent: '#9C27B0', icon: 'flag-outline',             label: 'Completed' },
  RIDE_REQUEST:   { accent: '#2196F3', icon: 'car-outline',              label: 'Request'   },
  RIDE_TAKEN:     { accent: '#FF9800', icon: 'alert-circle-outline',     label: 'Taken'     },
  NEW_FEEDBACK:   { accent: '#9C27B0', icon: 'star-outline',             label: 'Feedback'  },
};
const DEFAULT_CONFIG = { accent: '#9E9E9E', icon: 'notifications-outline', label: 'Info' };
const getCfg = (type?: string) => TYPE_CONFIG[type ?? ''] ?? DEFAULT_CONFIG;

const statusToTab = (status: string): string => {
  switch (status) {
    case 'PENDING':                return 'pending';
    case 'ACCEPTED':
    case 'IN_PROGRESS':            return 'active';
    case 'COMPLETED':              return 'completed';
    case 'CANCELLED_BY_PASSENGER':
    case 'CANCELLED_BY_DRIVER':    return 'cancelled';
    default:                       return 'pending';
  }
};

function Avatar({ notif, accent }: { notif: Notification; accent: string }) {
  const cfg      = getCfg(notif.type);
  const initials = `${notif.prenom?.[0] ?? ''}${notif.nom?.[0] ?? ''}`.toUpperCase();
  return (
    <View style={[st.avatar, { backgroundColor: accent + '18', borderColor: accent + '40' }]}>
      {notif.photoUrl
        ? <Image source={{ uri: notif.photoUrl }} style={st.avatarImg} />
        : initials
          ? <Text style={[st.initials, { color: accent }]}>{initials}</Text>
          : <Ionicons name={cfg.icon} size={22} color={accent} />
      }
    </View>
  );
}

export default function NotificationsScreen() {
  const { notifications, clearNotifications, markAllAsRead } = useNotifications();
  const { user } = useAuth();

  const [newNotifs, setNewNotifs] = useState<Notification[]>([]);
  const [oldNotifs, setOldNotifs] = useState<Notification[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const snapshotDone = useRef(false);

  useFocusEffect(useCallback(() => {
    snapshotDone.current = false;
    return () => { snapshotDone.current = false; };
  }, []));

  useFocusEffect(useCallback(() => {
    if (snapshotDone.current || notifications.length === 0) return;
    snapshotDone.current = true;
    const unread = notifications.filter(n => n.isRead === false);
    const read   = notifications.filter(n => n.isRead !== false);
    setNewNotifs(unread);
    setOldNotifs(read);
    if (unread.length > 0) markAllAsRead();
  }, [notifications, markAllAsRead]));

  const handlePress = async (notif: Notification) => {
    if (!notif.rideId) return;
    setLoadingId(notif.rideId);
    try {
      const res    = await api.get(`/rides/${notif.rideId}`);
      const status = res?.data?.data?.status ?? res?.data?.status ?? '';
      const tab    = statusToTab(status);
      const route  = user?.role === 'driver'
        ? '/(driverTabs)/Activity'
        : '/(passengerTabs)/Activity';
      router.push({ pathname: route as any, params: { rideId: String(notif.rideId), tab } });
    } catch {
      const route = user?.role === 'driver'
        ? '/(driverTabs)/Activity'
        : '/(passengerTabs)/Activity';
      router.push({ pathname: route as any, params: { rideId: String(notif.rideId), tab: 'pending' } });
    } finally {
      setLoadingId(null);
    }
  };

  const renderNotif = (notif: Notification, i: number, isNew: boolean) => {
    const cfg      = getCfg(notif.type);
    const tappable = !!notif.rideId;
    const loading  = loadingId === notif.rideId;

    return (
      <TouchableOpacity
        key={i}
        style={[st.row, isNew && st.rowNew]}
        onPress={() => handlePress(notif)}
        activeOpacity={tappable ? 0.7 : 1}
        disabled={!tappable || !!loadingId}
      >
        {isNew && <View style={[st.unreadDot, { backgroundColor: cfg.accent }]} />}

        <Avatar notif={notif} accent={cfg.accent} />

        <View style={st.content}>
          <View style={st.topRow}>
            <Text style={st.title} numberOfLines={1}>{notif.title}</Text>
            {notif.timestamp && (
              <Text style={st.time}>{getRelativeTime(notif.timestamp)}</Text>
            )}
          </View>
          <Text style={st.msg} numberOfLines={2}>{notif.message}</Text>
          {tappable && (
            <View style={st.tapRow}>
              {loading
                ? <ActivityIndicator size="small" color={cfg.accent} />
                : <Text style={[st.tapHint, { color: cfg.accent }]}>View ride →</Text>
              }
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const allEmpty = newNotifs.length === 0 && oldNotifs.length === 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={st.container}>

        <View style={st.header}>
          <View>
            <Text style={st.headerTitle}>Notifications</Text>
            {!allEmpty && (
              <Text style={st.headerSub}>
                {newNotifs.length > 0 ? `${newNotifs.length} new` : 'All caught up'}
              </Text>
            )}
          </View>
          {!allEmpty && (
            <TouchableOpacity
              style={st.clearBtn}
              onPress={() => { clearNotifications(); setNewNotifs([]); setOldNotifs([]); }}
            >
              <Text style={st.clearBtnText}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        {allEmpty ? (
          <View style={st.empty}>
            <View style={st.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={32} color="#C4C4C4" />
            </View>
            <Text style={st.emptyTitle}>No notifications</Text>
            <Text style={st.emptySub}>Your ride alerts will appear here</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

            {newNotifs.length > 0 && (
              <>
                <View style={st.sectionHeader}>
                  <Text style={st.sectionLabel}>New</Text>
                  <View style={st.sectionLine} />
                </View>
                {newNotifs.map((n, i) => renderNotif(n, i, true))}
              </>
            )}

            {oldNotifs.length > 0 && (
              <>
                <View style={st.sectionHeader}>
                  <Text style={[st.sectionLabel, { color: '#BDBDBD' }]}>Earlier</Text>
                  <View style={st.sectionLine} />
                </View>
                {oldNotifs.map((n, i) => renderNotif(n, newNotifs.length + i, false))}
              </>
            )}

          </ScrollView>
        )}
      </View>
    </>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 58, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111', letterSpacing: -0.4 },
  headerSub:   { fontSize: 12, color: '#BDBDBD', fontWeight: '500', marginTop: 2 },
  clearBtn:    { backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  clearBtnText:{ fontSize: 12, fontWeight: '600', color: '#9E9E9E' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
  sectionLabel:  { fontSize: 11, fontWeight: '700', color: '#111', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionLine:   { flex: 1, height: 1, backgroundColor: '#F0F0F0' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F7F7F7',
  },
  rowNew: { backgroundColor: '#FAFAFA' },

  unreadDot: {
    position: 'absolute', left: 0, top: '50%',
    width: 3, height: 32, borderRadius: 2, marginTop: -16,
  },

  // Simple avatar — tinted bg, no border noise
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 14,
  },
  avatarImg: { width: 46, height: 46, borderRadius: 23 },
  initials:  { fontSize: 15, fontWeight: '700' },

  content: { flex: 1 },
  topRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  title:   { fontSize: 13, fontWeight: '700', color: '#111', flex: 1, marginRight: 8 },
  time:    { fontSize: 11, color: '#C4C4C4' },
  msg:     { fontSize: 12, color: '#757575', lineHeight: 17 },
  tapRow:  { marginTop: 4, height: 16, justifyContent: 'center' },
  tapHint: { fontSize: 11, fontWeight: '700' },

  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingBottom: 80 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#424242' },
  emptySub:   { fontSize: 13, color: '#BDBDBD', textAlign: 'center', paddingHorizontal: 50 },
});