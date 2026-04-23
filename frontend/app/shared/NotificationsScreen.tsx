import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import UserAvatar from '../../components/UserAvatar';

type Notification = {
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

const getRelativeTime = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

const TYPE_CONFIG: Record<string, { accent: string; icon: any }> = {
  RIDE_ACCEPTED: { accent: '#22C55E', icon: 'checkmark-circle-outline' },
  RIDE_REJECTED: { accent: '#EF4444', icon: 'close-circle-outline' },
  RIDE_CANCELLED: { accent: '#EF4444', icon: 'ban-outline' },
  RIDE_STARTED: { accent: '#3B82F6', icon: 'navigate-outline' },
  RIDE_COMPLETED: { accent: '#8B5CF6', icon: 'flag-outline' },
  RIDE_REQUEST: { accent: '#3B82F6', icon: 'car-outline' },
  RIDE_TAKEN: { accent: '#F59E0B', icon: 'alert-circle-outline' },
  NEW_FEEDBACK: { accent: '#8B5CF6', icon: 'star-outline' },
};
const DEFAULT_CFG = { accent: '#9CA3AF', icon: 'notifications-outline' };
const getCfg = (type?: string) => TYPE_CONFIG[type ?? ''] ?? DEFAULT_CFG;

const statusToTab = (status: string) => {
  switch (status) {
    case 'PENDING': return 'pending';
    case 'ACCEPTED':
    case 'IN_PROGRESS': return 'accepted';
    case 'COMPLETED': return 'completed';
    case 'CANCELLED_BY_PASSENGER':
    case 'CANCELLED_BY_DRIVER': return 'cancelled';
    default: return 'pending';
  }
};

export default function NotificationsScreen() {
  const { notifications, clearNotifications, markAsRead } = useNotifications();
  const { user } = useAuth();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const newNotifs = useMemo(() => notifications.filter((n) => n.isRead === false), [notifications]);
  const oldNotifs = useMemo(() => notifications.filter((n) => n.isRead !== false), [notifications]);

  const handlePress = async (notif: Notification) => {
    if (!notif.rideId) return;
    setLoadingId(notif.rideId);
    try {
      if (notif.isRead === false) {
        // Mark only the clicked notification as read (do not mark all).
        markAsRead(notif);
      }
      const res = await api.get(`/rides/${notif.rideId}`);
      const status = res?.data?.data?.status ?? res?.data?.status ?? '';
      const route = user?.role === 'driver' ? '/(driverTabs)/Activity' : '/(passengerTabs)/Activity';
      router.push({ pathname: route as any, params: { rideId: String(notif.rideId), tab: statusToTab(status) } });
    } catch {
      const route = user?.role === 'driver' ? '/(driverTabs)/Activity' : '/(passengerTabs)/Activity';
      router.push({ pathname: route as any, params: { rideId: String(notif.rideId), tab: 'pending' } });
    } finally {
      setLoadingId(null);
    }
  };

  const renderNotif = (notif: Notification, i: number, isNew: boolean) => {
    const cfg = getCfg(notif.type);
    const tappable = !!notif.rideId;

    return (
      <TouchableOpacity
        key={i}
        style={[st.row, isNew ? st.rowNew : st.rowOld]}
        onPress={() => handlePress(notif)}
        activeOpacity={tappable ? 0.7 : 1}
        disabled={!tappable || !!loadingId}
      >
        {/* left accent bar — red for new, transparent for old */}
        <View style={[st.accentBar, { backgroundColor: isNew ? '#EF4444' : 'transparent' }]} />

        {/* avatar */}
        <UserAvatar
          prenom={notif.prenom}
          nom={notif.nom}
          photoUrl={notif.photoUrl}
          size={44}
          backgroundColor={cfg.accent + '20'}
          textColor={cfg.accent}
          style={st.avatar}
          fallback={<Ionicons name={cfg.icon} size={20} color={cfg.accent} />}
        />

        {/* content */}
        <View style={st.content}>
          <View style={st.topRow}>
            <Text style={[st.title, !isNew && st.titleOld]} numberOfLines={1}>{notif.title}</Text>
            {notif.timestamp && <Text style={st.time}>{getRelativeTime(notif.timestamp)}</Text>}
          </View>
          <Text style={st.msg} numberOfLines={2}>{notif.message}</Text>
          {tappable && (
            <View style={st.tapRow}>
              {loadingId === notif.rideId
                ? <ActivityIndicator size="small" color={cfg.accent} />
                : <Text style={[st.tapHint, { color: cfg.accent }]}>View ride →</Text>
              }
            </View>
          )}
        </View>

        {/* unread dot */}
        {isNew && <View style={st.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const allEmpty = newNotifs.length === 0 && oldNotifs.length === 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={st.screen}>

        {/* header */}
        <View style={st.header}>
          <View>
            <Text style={st.headerTitle}>Notifications</Text>
            <Text style={st.headerSub}>
              {allEmpty ? 'Nothing here yet' : newNotifs.length > 0 ? `${newNotifs.length} unread` : 'All caught up'}
            </Text>
          </View>
          {!allEmpty && (
            <TouchableOpacity style={st.clearBtn} onPress={() => { clearNotifications(); }}>
              <Text style={st.clearTxt}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        {allEmpty ? (
          <View style={st.empty}>
            <View style={st.emptyCircle}>
              <Ionicons name="notifications-off-outline" size={30} color="#D1D5DB" />
            </View>
            <Text style={st.emptyTitle}>No notifications</Text>
            <Text style={st.emptySub}>Your ride alerts will appear here</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

            {newNotifs.length > 0 && (
              <>
                <View style={st.section}>
                  <View style={[st.sectionDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={[st.sectionTxt, { color: '#EF4444' }]}>New</Text>
                  <View style={st.sectionLine} />
                </View>
                {newNotifs.map((n, i) => renderNotif(n, i, true))}
              </>
            )}

            {oldNotifs.length > 0 && (
              <>
                <View style={st.section}>
                  <View style={[st.sectionDot, { backgroundColor: '#D1D5DB' }]} />
                  <Text style={[st.sectionTxt, { color: '#9CA3AF' }]}>Earlier</Text>
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
  screen: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111', letterSpacing: -0.4 },
  headerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  clearBtn: { backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  clearTxt: { fontSize: 12, fontWeight: '600', color: '#6B7280' },

  section: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
  sectionTxt: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },

  // new = white card, old = flat on gray bg
  row: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    borderRadius: 14, padding: 14,
    overflow: 'hidden',
  },
  rowNew: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  rowOld: { backgroundColor: '#fff', opacity: 0.75 },

  accentBar: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2 },

  avatar: { justifyContent: 'center', alignItems: 'center', marginRight: 12 },

  content: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  title: { fontSize: 13, fontWeight: '700', color: '#111', flex: 1, marginRight: 8 },
  titleOld: { color: '#6B7280' },
  time: { fontSize: 11, color: '#C4C4C4' },
  msg: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  tapRow: { marginTop: 5, height: 16 },
  tapHint: { fontSize: 11, fontWeight: '700' },

  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginLeft: 8 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingBottom: 80 },
  emptyCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 50 },
});
