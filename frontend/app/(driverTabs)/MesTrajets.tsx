import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRide } from '../../context/RideContext';

const parseHeureDepart = (value?: string) => {
  if (!value) return null;
  const parts = String(value).trim().split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
};

const getDepartAt = (ride: any) => {
  if (!ride?.dateDepart) return null;
  const d = new Date(ride.dateDepart);
  if (Number.isNaN(d.getTime())) return null;
  const hm = parseHeureDepart(ride.heureDepart);
  if (hm) d.setHours(hm.h, hm.m, 0, 0);
  return d;
};

function RideCard({ item, onPress }: { item: any; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  const start = item.startAddress || item.depart      || 'Départ';
  const end   = item.endAddress   || item.destination || 'Destination';
  const trunc = (str: string, n = 28) => str.length > n ? str.slice(0, n) + '…' : str;

  const date = item.dateDepart
    ? new Date(item.dateDepart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    : '—';
  const time = item.heureDepart || '—';

  const isInProgress = item.status === 'IN_PROGRESS';

  // Nom du passager
  const passengerName = item.passenger
  ? `${item.passenger.prenom} ${item.passenger.nom}`
  : null;

  const initials = passengerName
    ? passengerName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}>
      <Animated.View style={[s.card, { transform: [{ scale }] }]}>

        {/* Status pill + date/heure */}
        <View style={s.cardTop}>
          <View style={[s.statusPill, isInProgress ? s.statusInProgress : s.statusAccepted]}>
            <View style={[s.statusDot, { backgroundColor: isInProgress ? '#854D0E' : '#166534' }]} />
            <Text style={[s.statusText, { color: isInProgress ? '#854D0E' : '#166534' }]}>
              {isInProgress ? 'In progress' : 'Accepted'}
            </Text>
          </View>
          <View style={s.timeRow}>
            <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
            <Text style={s.timeText}>{date}</Text>
            <Text style={s.timeSep}>·</Text>
            <Ionicons name="time-outline" size={12} color="#9CA3AF" />
            <Text style={s.timeText}>{time}</Text>
          </View>
        </View>

        {/* Nom du passager */}
        <View style={s.passengerRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.passengerName}>
            {passengerName || 'Passager inconnu'}
          </Text>
        </View>

        {/* Route */}
        <View style={s.routeBlock}>
          <View style={s.routeRow}>
            <View style={[s.dot, { backgroundColor: '#22C55E' }]} />
            <Text style={s.routeText} numberOfLines={1}>{trunc(start)}</Text>
          </View>
          <View style={s.routeLine} />
          <View style={s.routeRow}>
            <View style={[s.dot, { backgroundColor: '#EF4444' }]} />
            <Text style={s.routeText} numberOfLines={1}>{trunc(end)}</Text>
          </View>
        </View>

        {/* Open map button */}
        <View style={s.trackRow}>
          <Ionicons name="navigate-outline" size={13} color="#2563EB" />
          <Text style={s.trackText}>Open ride map</Text>
        </View>

      </Animated.View>
    </TouchableOpacity>
  );
}

export default function MesTrajets() {
  const { driverRequests, currentRide, getDriverRequests, getDriverActiveRide, loading } = useRide();
  const [screenLoading, setScreenLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          await Promise.all([getDriverRequests(), getDriverActiveRide()]);
        } finally {
          if (active) setScreenLoading(false);
        }
      })();
      return () => { active = false; };
    }, [])
  );

  const rides = useMemo(() => {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = Date.now();
    const map = new Map();
    (driverRequests || []).forEach((ride: any) => {
      if (ride.status === 'ACCEPTED' || ride.status === 'IN_PROGRESS') {
        map.set(ride.id, ride);
      }
    });
    if (currentRide && (currentRide.status === 'ACCEPTED' || currentRide.status === 'IN_PROGRESS')) {
      map.set(currentRide.id, currentRide);
    }
    return Array.from(map.values())
      .filter((ride: any) => {
        if (ride.status === 'IN_PROGRESS') return true;
        const departAt = getDepartAt(ride);
        if (!departAt) return false;
        const diff = departAt.getTime() - now;
        return diff >= 0 && diff <= ONE_HOUR_MS;
      })
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [driverRequests, currentRide]);

  const openRide = (ride: any) => {
    router.push({
      pathname: '/driver/ActiveRideScreen',
      params: { trajetId: String(ride.id) },
    });
  };

  if ((screenLoading || loading) && rides.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#111" />
        <Text style={s.subtle}>Chargement des trajets...</Text>
      </View>
    );
  }

  if (rides.length === 0) {
    return (
      <View style={s.center}>
        <View style={s.emptyCircle}>
          <Ionicons name="car-outline" size={30} color="#D1D5DB" />
        </View>
        <Text style={s.emptyTitle}>Aucun trajet actif</Text>
        <Text style={s.subtle}>Les trajets acceptés apparaîtront ici.</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <FlatList
        data={rides}
        keyExtractor={(item: any) => String(item.id)}
        contentContainerStyle={s.list}
        renderItem={({ item }: any) => (
          <RideCard item={item} onPress={() => openRide(item)} />
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  list:      { padding: 16, gap: 10 },

  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  emptyCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:  { fontSize: 16, fontWeight: '700', color: '#111' },
  subtle:      { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  // Top row
  cardTop:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  statusPill:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusAccepted:   { backgroundColor: '#DCFCE7' },
  statusInProgress: { backgroundColor: '#FEF9C3' },
  statusDot:        { width: 6, height: 6, borderRadius: 3 },
  statusText:       { fontSize: 11, fontWeight: '700' },
  timeRow:          { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText:         { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  timeSep:          { fontSize: 11, color: '#D1D5DB' },

  // Passenger
  passengerRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  avatar:        { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  avatarText:    { fontSize: 11, fontWeight: '700', color: '#2563EB' },
  passengerName: { fontSize: 13, fontWeight: '600', color: '#111', flex: 1 },

  // Route
  routeBlock: { gap: 4, marginBottom: 12 },
  routeRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  routeLine:  { width: 1.5, height: 10, backgroundColor: '#E5E7EB', marginLeft: 3.25 },
  routeText:  { fontSize: 14, color: '#111', fontWeight: '600', flex: 1 },

  // Track
  trackRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10 },
  trackText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
});
