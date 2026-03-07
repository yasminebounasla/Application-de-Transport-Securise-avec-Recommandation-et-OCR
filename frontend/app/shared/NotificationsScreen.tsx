import React, { useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Image,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../../context/NotificationContext';

type Notification = {
  title: string;
  message: string;
  timestamp?: number;
  isRead?: boolean;
  photoUrl?: string;
  prenom?: string;
  nom?: string;
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

  // ✅ VRAI FIX : on snapshote les listes entières au focus
  // PAS unreadCount (peut être 0), PAS isRead (changé par markAllAsRead immédiatement)
  // → on copie les 2 listes au moment exact du focus, AVANT markAllAsRead
  const [newNotifs, setNewNotifs] = useState<Notification[]>([]);
  const [oldNotifs, setOldNotifs] = useState<Notification[]>([]);
  const hasSnapshotted = useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      // Reset à chaque fois qu'on revient sur l'écran
      hasSnapshotted.current = false;
    }, [])
  );

  // Snapshot au premier render après le focus, quand notifications est chargé
  // useRef empêche de re-snapshoter si markAllAsRead re-render le composant
  if (!hasSnapshotted.current && notifications.length > 0) {
    hasSnapshotted.current = true;
    const unread = notifications.filter(n => !n.isRead);
    const read   = notifications.filter(n =>  n.isRead);
    setNewNotifs(unread);
    setOldNotifs(read);
    markAllAsRead();
  }

  const renderNotif = (notif: Notification, i: number, isNew: boolean) => {
    const cat = CATEGORY(notif.title);
    return (
      <View key={i} style={[styles.row, isNew && styles.rowNew]}>
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
        </View>
      </View>
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
            <TouchableOpacity onPress={() => { clearNotifications(); setNewNotifs([]); setOldNotifs([]); }} activeOpacity={0.7}>
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
  container:    { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 58, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F2',
  },
  headerTitle:     { fontSize: 22, fontWeight: '800', color: '#111', letterSpacing: -0.4 },
  clearBtn:        { fontSize: 13, color: '#BBB', fontWeight: '500' },
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
  rowNew:         { backgroundColor: '#FFF8F8' },
  newDot:         { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 8 },
  avatarWrapper:  { position: 'relative', marginRight: 13 },
  avatar:         { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  initials:       { color: '#fff', fontSize: 16, fontWeight: '700' },
  badge: {
    position: 'absolute', bottom: 0, right: -1,
    width: 17, height: 17, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  content:  { flex: 1 },
  topRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  title:    { fontSize: 14, fontWeight: '700', color: '#111', flex: 1 },
  time:     { fontSize: 12, color: '#BBB', marginLeft: 8 },
  msg:      { fontSize: 13, color: '#666', lineHeight: 18 },
  empty:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingBottom: 80 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#F7F7F7',
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#222' },
  emptySub:   { fontSize: 13, color: '#BBB', textAlign: 'center', paddingHorizontal: 50 },
});