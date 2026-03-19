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
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

// Catégorie basée sur le titre — détermine couleur + icône
const getCategory = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('accepted') || t.includes('accepté') || t.includes('confirmé') || t.includes('démarré') || t.includes('started'))
    return { color: '#16A34A', bg: '#F0FDF4', borderColor: '#BBF7D0', icon: 'checkmark-circle' as const };
  if (t.includes('reject') || t.includes('refus') || t.includes('annulé') || t.includes('cancelled') || t.includes('expir'))
    return { color: '#DC2626', bg: '#FEF2F2', borderColor: '#FECACA', icon: 'close-circle'     as const };
  if (t.includes('completed') || t.includes('terminé') || t.includes('arrivé'))
    return { color: '#7C3AED', bg: '#F5F3FF', borderColor: '#DDD6FE', icon: 'flag'              as const };
  if (t.includes('request') || t.includes('demande') || t.includes('créé') || t.includes('nouvelle'))
    return { color: '#2563EB', bg: '#EFF6FF', borderColor: '#BFDBFE', icon: 'car'               as const };
  return   { color: '#D97706', bg: '#FFFBEB', borderColor: '#FDE68A', icon: 'notifications'     as const };
};

const getTabFromTitle = (title: string): string => {
  const t = title.toLowerCase();
  if (t.includes('terminé') || t.includes('completed')) return 'completed';
  if (t.includes('annulé') || t.includes('refus') || t.includes('cancelled') || t.includes('rejected')) return 'cancelled';
  if (t.includes('accepted') || t.includes('accepté') || t.includes('started') || t.includes('démarré') || t.includes('in progress')) return 'active';
  return 'pending';
};

// Avatar initiales ou photo
function NotifAvatar({ notif, cat }: { notif: Notification; cat: ReturnType<typeof getCategory> }) {
  const initials = `${notif.prenom?.[0] ?? ''}${notif.nom?.[0] ?? ''}`.toUpperCase();
  return (
    <View style={st.avatarWrap}>
      {notif.photoUrl ? (
        <Image source={{ uri: notif.photoUrl }} style={st.avatarImg} />
      ) : initials ? (
        <View style={[st.avatarImg, st.avatarFallback, { backgroundColor: cat.bg, borderColor: cat.borderColor }]}>
          <Text style={[st.initials, { color: cat.color }]}>{initials}</Text>
        </View>
      ) : (
        <View style={[st.avatarImg, st.avatarFallback, { backgroundColor: cat.bg, borderColor: cat.borderColor }]}>
          <Ionicons name={cat.icon} size={20} color={cat.color} />
        </View>
      )}
      {/* Badge icône en bas à droite */}
      <View style={[st.iconBadge, { backgroundColor: cat.color }]}>
        <Ionicons name={cat.icon} size={9} color="#fff" />
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
    if (snapshotDone.current || notifications.length === 0) return;
    snapshotDone.current = true;
    const unread = notifications.filter(n => n.isRead === false);
    const read   = notifications.filter(n => n.isRead !== false);
    setNewNotifs(unread);
    setOldNotifs(read);
    if (unread.length > 0) markAllAsRead();
  }, [notifications, markAllAsRead]));

  const handlePress = (notif: Notification) => {
    if (!notif.rideId) return;
    const tab   = getTabFromTitle(notif.title);
    const route = user?.role === 'driver'
      ? '/(driverTabs)/Activity'
      : '/(passengerTabs)/Activity';
    router.push({ pathname: route as any, params: { rideId: String(notif.rideId), tab } });
  };

  const renderNotif = (notif: Notification, i: number, isNew: boolean) => {
    const cat      = getCategory(notif.title);
    const tappable = !!notif.rideId;
    return (
      <TouchableOpacity
        key={i}
        style={[st.row, isNew && st.rowNew]}
        onPress={() => handlePress(notif)}
        activeOpacity={tappable ? 0.72 : 1}
        disabled={!tappable}
      >
        {/* Unread indicator */}
        {isNew && <View style={[st.unreadBar, { backgroundColor: cat.color }]} />}

        <NotifAvatar notif={notif} cat={cat} />

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
              <Text style={[st.tapHint, { color: cat.color }]}>View ride</Text>
              <Ionicons name="arrow-forward" size={11} color={cat.color} />
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

        {/* Header */}
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
              activeOpacity={0.7}
            >
              <Text style={st.clearBtnText}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        {allEmpty ? (
          <View style={st.empty}>
            <View style={st.emptyIconWrap}>
              <Ionicons name="notifications-off-outline" size={34} color="#D1D5DB" />
            </View>
            <Text style={st.emptyTitle}>No notifications</Text>
            <Text style={st.emptySub}>Your ride alerts will appear here</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

            {newNotifs.length > 0 && (
              <>
                <View style={st.sectionHeader}>
                  <View style={[st.sectionDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={[st.sectionLabel, { color: '#EF4444' }]}>New</Text>
                  <View style={[st.sectionLine, { backgroundColor: '#FECACA' }]} />
                </View>
                {newNotifs.map((n, i) => renderNotif(n, i, true))}
              </>
            )}

            {oldNotifs.length > 0 && (
              <>
                <View style={st.sectionHeader}>
                  <View style={[st.sectionDot, { backgroundColor: '#D1D5DB' }]} />
                  <Text style={[st.sectionLabel, { color: '#9CA3AF' }]}>Earlier</Text>
                  <View style={[st.sectionLine, { backgroundColor: '#F0F0F0' }]} />
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
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111', letterSpacing: -0.4 },
  headerSub:   { fontSize: 12, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },
  clearBtn:    { backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  clearBtnText:{ fontSize: 12, fontWeight: '700', color: '#6B7280' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8, gap: 8 },
  sectionDot:    { width: 7, height: 7, borderRadius: 4 },
  sectionLabel:  { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionLine:   { flex: 1, height: 1 },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F7F7F7',
    position: 'relative',
  },
  rowNew:     { backgroundColor: '#FAFAFA' },
  unreadBar:  { position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderRadius: 2 },

  // Avatar
  avatarWrap:    { position: 'relative', marginRight: 14 },
  avatarImg:     { width: 46, height: 46, borderRadius: 23 },
  avatarFallback:{ justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  initials:      { fontSize: 16, fontWeight: '800' },
  iconBadge: {
    position: 'absolute', bottom: -1, right: -1,
    width: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },

  content: { flex: 1 },
  topRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  title:   { fontSize: 14, fontWeight: '700', color: '#111', flex: 1, marginRight: 8 },
  time:    { fontSize: 11, color: '#C4C4C4', fontWeight: '500' },
  msg:     { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  tapRow:  { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5 },
  tapHint: { fontSize: 11, fontWeight: '700' },

  // Empty
  empty:        { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingBottom: 80 },
  emptyIconWrap:{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F7F7F7', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 17, fontWeight: '700', color: '#374151' },
  emptySub:     { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 50 },
});