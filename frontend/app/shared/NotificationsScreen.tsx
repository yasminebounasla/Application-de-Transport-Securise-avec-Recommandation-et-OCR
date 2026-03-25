<<<<<<< HEAD
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Image,
} from 'react-native';
import { Stack, useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

type Notification = {
  title: string;
  message: string;
  timestamp?: number;
  isRead?: boolean;
  photoUrl?: string;
  prenom?: string;
  nom?: string;
  rideId?: number;
};

const getRelativeTime = (timestamp: number) => {
  const diff  = Date.now() - timestamp;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "À l'instant";
  if (mins < 60)  return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}j`;
};

const CATEGORY = (title: string) => {
  if (title.includes('confirmé') || title.includes('accepté') || title.includes('démarré'))
    return { color: '#22C55E', bg: '#F0FFF4', icon: 'checkmark-circle' as const };
  if (title.includes('refus') || title.includes('annulé') || title.includes('expirée'))
    return { color: '#EF4444', bg: '#FFF5F5', icon: 'close-circle' as const };
  if (title.includes('envoyée') || title.includes('créé') || title.includes('demande'))
    return { color: '#3B82F6', bg: '#EFF6FF', icon: 'car' as const };
  if (title.includes('terminé') || title.includes('arrivé'))
    return { color: '#8B5CF6', bg: '#F5F3FF', icon: 'flag' as const };
  return { color: '#F59E0B', bg: '#FFFBEB', icon: 'alert-circle' as const };
};

// ✅ FIX : On s'assure que le retour correspond aux clés de l'ActivityScreen
const getTabFromTitle = (title: string): string => {
  const t = title.toLowerCase();
  if (t.includes('terminé') || t.includes('completed')) return 'completed';
  if (t.includes('annulé') || t.includes('refus')) return 'cancelled';
  return 'pending'; 
};

const AVATAR_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
const getAvatarColor = (name: string) =>
  AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];

function NotifAvatar({ notif, cat }: { notif: Notification; cat: ReturnType<typeof CATEGORY> }) {
  const initials = `${notif.prenom?.[0] ?? ''}${notif.nom?.[0] ?? ''}`.toUpperCase();
  return (
    <View style={styles.avatarWrapper}>
      {notif.photoUrl ? (
        <Image source={{ uri: notif.photoUrl }} style={styles.avatar} />
      ) : initials ? (
        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: getAvatarColor(notif.prenom ?? '') }]}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
      ) : (
        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: cat.bg }]}>
          <Ionicons name={cat.icon} size={22} color={cat.color} />
        </View>
      )}
      <View style={[styles.badge, { backgroundColor: cat.color }]}>
        <Ionicons name={cat.icon} size={8} color="#fff" />
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const { notifications, clearNotifications, markAllAsRead } = useNotifications();
  const { user } = useAuth();

  const [newNotifs, setNewNotifs] = useState<Notification[]>([]);
  const [oldNotifs, setOldNotifs] = useState<Notification[]>([]);
  const snapshotDone = useRef(false);

  useFocusEffect(useCallback(() => {
    snapshotDone.current = false;
    return () => { snapshotDone.current = false; };
  }, []));

  useFocusEffect(useCallback(() => {
    if (snapshotDone.current) return;
    if (notifications.length === 0) return;
    snapshotDone.current = true;
    const unread = notifications.filter(n => n.isRead === false);
    const read   = notifications.filter(n => n.isRead !== false);
    setNewNotifs(unread);
    setOldNotifs(read);
    if (unread.length > 0) markAllAsRead();
  }, [notifications, markAllAsRead]));

  const handleNotifPress = (notif: Notification) => {
  if (!notif.rideId) return;
  const tab = getTabFromTitle(notif.title);
  console.log('🟢 NAVIGATE rideId:', notif.rideId, 'tab:', tab); // ← AJOUTE
  const route = user?.role === 'driver'
    ? '/(driverTabs)/Activity'
    : '/(passengerTabs)/Activity';
  router.push({ pathname: route as any, params: { rideId: String(notif.rideId), tab } });
};

  const renderNotif = (notif: Notification, i: number, isNew: boolean) => {
    const cat = CATEGORY(notif.title);
    const tappable = !!notif.rideId;
    return (
      <TouchableOpacity
        key={i}
        style={[styles.row, isNew && styles.rowNew]}
        onPress={() => handleNotifPress(notif)}
        activeOpacity={tappable ? 0.7 : 1}
        disabled={!tappable}
      >
        {isNew && <View style={styles.newDot} />}
        <NotifAvatar notif={notif} cat={cat} />
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.title}>{notif.title}</Text>
            <Text style={styles.time}>
              {notif.timestamp ? getRelativeTime(notif.timestamp) : ''}
            </Text>
          </View>
          <Text style={styles.msg} numberOfLines={2}>{notif.message}</Text>
          {tappable && (
            <Text style={styles.tapHint}>Voir le trajet →</Text>
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
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {!allEmpty && (
            <TouchableOpacity
              onPress={() => { clearNotifications(); setNewNotifs([]); setOldNotifs([]); }}
              activeOpacity={0.7}
            >
              <Text style={styles.clearBtn}>Tout effacer</Text>
            </TouchableOpacity>
          )}
        </View>

        {allEmpty ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="notifications-outline" size={36} color="#CCC" />
            </View>
            <Text style={styles.emptyTitle}>Aucune notification</Text>
            <Text style={styles.emptySub}>Vos alertes de trajet apparaîtront ici</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {newNotifs.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionRedDot} />
                  <Text style={styles.sectionTitle}>Nouvelles</Text>
                  <View style={styles.sectionLine} />
                </View>
                {newNotifs.map((notif, i) => renderNotif(notif, i, true))}
              </>
            )}
            {oldNotifs.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitleOld}>Précédentes</Text>
                  <View style={styles.sectionLineGray} />
                </View>
                {oldNotifs.map((notif, i) => renderNotif(notif, newNotifs.length + i, false))}
              </>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 58, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F2',
  },
  headerTitle:     { fontSize: 22, fontWeight: '800', color: '#111', letterSpacing: -0.4 },
  clearBtn:         { fontSize: 13, color: '#BBB', fontWeight: '500' },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6, gap: 8,
  },
  sectionRedDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  sectionTitle:    { fontSize: 12, fontWeight: '700', color: '#EF4444', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionTitleOld: { fontSize: 12, fontWeight: '700', color: '#AAA', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionLine:     { flex: 1, height: 1, backgroundColor: '#FECACA' },
  sectionLineGray: { flex: 1, height: 1, backgroundColor: '#F0F0F0' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F7F7F7',
  },
  rowNew:          { backgroundColor: '#FFF8F8' },
  newDot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 8 },
  avatarWrapper:  { position: 'relative', marginRight: 13 },
  avatar:          { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  initials:        { color: '#fff', fontSize: 16, fontWeight: '700' },
  badge: {
    position: 'absolute', bottom: 0, right: -1,
    width: 17, height: 17, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  content:  { flex: 1 },
  topRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  title:    { fontSize: 14, fontWeight: '700', color: '#111', flex: 1 },
  time:      { fontSize: 12, color: '#BBB', marginLeft: 8 },
  msg:       { fontSize: 13, color: '#666', lineHeight: 18 },
  tapHint:  { fontSize: 11, color: '#3B82F6', marginTop: 4, fontWeight: '600' },
  empty:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingBottom: 80 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#F7F7F7',
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#222' },
  emptySub:   { fontSize: 13, color: '#BBB', textAlign: 'center', paddingHorizontal: 50 },
=======
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

const TYPE_CONFIG: Record<string, { accent: string; icon: any }> = {
  RIDE_ACCEPTED:  { accent: '#22C55E', icon: 'checkmark-circle-outline' },
  RIDE_REJECTED:  { accent: '#EF4444', icon: 'close-circle-outline'     },
  RIDE_CANCELLED: { accent: '#EF4444', icon: 'ban-outline'              },
  RIDE_STARTED:   { accent: '#3B82F6', icon: 'navigate-outline'         },
  RIDE_COMPLETED: { accent: '#8B5CF6', icon: 'flag-outline'             },
  RIDE_REQUEST:   { accent: '#3B82F6', icon: 'car-outline'              },
  RIDE_TAKEN:     { accent: '#F59E0B', icon: 'alert-circle-outline'     },
  NEW_FEEDBACK:   { accent: '#8B5CF6', icon: 'star-outline'             },
};
const DEFAULT_CFG = { accent: '#9CA3AF', icon: 'notifications-outline' };
const getCfg = (type?: string) => TYPE_CONFIG[type ?? ''] ?? DEFAULT_CFG;

const statusToTab = (status: string) => {
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
      const route  = user?.role === 'driver' ? '/(driverTabs)/Activity' : '/(passengerTabs)/Activity';
      router.push({ pathname: route as any, params: { rideId: String(notif.rideId), tab: statusToTab(status) } });
    } catch {
      const route = user?.role === 'driver' ? '/(driverTabs)/Activity' : '/(passengerTabs)/Activity';
      router.push({ pathname: route as any, params: { rideId: String(notif.rideId), tab: 'pending' } });
    } finally {
      setLoadingId(null);
    }
  };

  const renderNotif = (notif: Notification, i: number, isNew: boolean) => {
    const cfg      = getCfg(notif.type);
    const tappable = !!notif.rideId;
    const initials = `${notif.prenom?.[0] ?? ''}${notif.nom?.[0] ?? ''}`.toUpperCase();

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
        <View style={[st.avatar, { backgroundColor: cfg.accent + '20' }]}>
          {notif.photoUrl
            ? <Image source={{ uri: notif.photoUrl }} style={st.avatarImg} />
            : initials
              ? <Text style={[st.initials, { color: cfg.accent }]}>{initials}</Text>
              : <Ionicons name={cfg.icon} size={20} color={cfg.accent} />
          }
        </View>

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
            <TouchableOpacity style={st.clearBtn} onPress={() => { clearNotifications(); setNewNotifs([]); setOldNotifs([]); }}>
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
  headerSub:   { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  clearBtn:    { backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  clearTxt:    { fontSize: 12, fontWeight: '600', color: '#6B7280' },

  section:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
  sectionTxt: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionLine:{ flex: 1, height: 1, backgroundColor: '#E5E7EB' },

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

  avatar:    { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  initials:  { fontSize: 15, fontWeight: '700' },

  content: { flex: 1 },
  topRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  title:   { fontSize: 13, fontWeight: '700', color: '#111', flex: 1, marginRight: 8 },
  titleOld:{ color: '#6B7280' },
  time:    { fontSize: 11, color: '#C4C4C4' },
  msg:     { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  tapRow:  { marginTop: 5, height: 16 },
  tapHint: { fontSize: 11, fontWeight: '700' },

  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginLeft: 8 },

  empty:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingBottom: 80 },
  emptyCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle:  { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptySub:    { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 50 },
>>>>>>> 46ff32f16fb87b43f9091e209998127c51f2ff47
});