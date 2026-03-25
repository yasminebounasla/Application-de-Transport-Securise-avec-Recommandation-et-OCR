import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRide } from '../../context/RideContext';

const TRACKING_WINDOW_MINUTES = 60;

const minutesUntilDeparture = (dateValue?: string) => {
  if (!dateValue) return Number.POSITIVE_INFINITY;
  return (new Date(dateValue).getTime() - Date.now()) / 60000;
};

function RideCard({ item, highlighted, onPress }: {
  item: any; highlighted: boolean; onPress: () => void;
}) {
  const glowAnim = useRef(new Animated.Value(0)).current;
  const scale    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!highlighted) { glowAnim.setValue(0); return; }
    Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.delay(1200),
      Animated.timing(glowAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
    ]).start();
  }, [highlighted]);

  const borderColor = glowAnim.interpolate({ inputRange: [0, 1], outputRange: ['#F3F4F6', '#111111'] });
  const bgColor     = glowAnim.interpolate({ inputRange: [0, 1], outputRange: ['#FFFFFF', '#F3F4F6'] });

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

  return (
    <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}>
      <Animated.View style={[s.card, { borderColor, backgroundColor: bgColor, transform: [{ scale }] }]}>

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

        {/* Route — simple */}
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

        {/* Track button */}
        <View style={s.trackRow}>
          <Ionicons name="navigate-outline" size={13} color="#2563EB" />
          <Text style={s.trackText}>Track ride</Text>
        </View>

      </Animated.View>
    </TouchableOpacity>
  );
}

export default function MesTrajets() {
  const { passengerRides, getPassengerRides, loading } = useRide();
  const params = useLocalSearchParams<{ rideId?: string; highlight?: string }>();

  const [screenLoading, setScreenLoading] = useState(true);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  const flatListRef      = useRef<FlatList>(null);
  const pendingHighlight = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try { await getPassengerRides(); }
        finally { if (active) setScreenLoading(false); }
      })();
      return () => { active = false; };
    }, [])
  );

  useEffect(() => {
    if (!params.rideId || params.highlight !== 'true') return;
    pendingHighlight.current = parseInt(params.rideId);
  }, [params.rideId, params.highlight]);

  const rides = useMemo(() =>
    (passengerRides || []).filter((r: any) =>
      ['ACCEPTED', 'IN_PROGRESS'].includes(r.status)
    ), [passengerRides]);

  useEffect(() => {
    if (!rides.length || !pendingHighlight.current) return;
    const targetId = pendingHighlight.current;
    const index    = rides.findIndex((r: any) => r.id === targetId);
    if (index < 0) return;
    pendingHighlight.current = null;
    setHighlightedId(targetId);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
    }, 400);
    setTimeout(() => setHighlightedId(null), 5000);
  }, [rides]);

  const openRide = (ride: any) => {
    const minsLeft = minutesUntilDeparture(ride.dateDepart);
    const canTrack = ride.status === 'ACCEPTED' || ride.status === 'IN_PROGRESS' || minsLeft <= TRACKING_WINDOW_MINUTES;
    if (canTrack) {
      router.push({ pathname: '/passenger/RideTrackingScreen', params: { trajetId: String(ride.id) } });
    } else {
      router.push({ pathname: '/passenger/HistoryScreen', params: { trajetId: String(ride.id) } });
    }
  };

  if ((screenLoading || loading) && rides.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#111" />
        <Text style={s.subtle}>Loading...</Text>
      </View>
    );
  }

  if (rides.length === 0) {
    return (
      <View style={s.center}>
        <View style={s.emptyCircle}>
          <Ionicons name="car-outline" size={30} color="#D1D5DB" />
        </View>
        <Text style={s.emptyTitle}>No active rides</Text>
        <Text style={s.subtle}>Accepted and in-progress rides appear here.</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <FlatList
        ref={flatListRef}
        data={rides}
        keyExtractor={(item: any) => String(item.id)}
        contentContainerStyle={s.list}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item }: any) => (
          <RideCard
            item={item}
            highlighted={item.id === highlightedId}
            onPress={() => openRide(item)}
          />
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
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5,
    borderColor: '#F3F4F6', padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
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
