import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const { width: SW, height: SH } = Dimensions.get('window');

type UpcomingRide = {
  rideId: number;
  dateDepart: string;
  heureDepart: string;
  startAddress: string;
  endAddress: string;
  driver?: { prenom: string; nom: string };
  passenger?: { prenom: string; nom: string };
  status: string;
};

const REMINDER_WINDOW_MS = 60 * 60 * 1000;

// ← outside component so it survives remounts
let reminderShownForRideId: number | null = null;

export default function ReminderModal() {
  const { user } = useAuth();
  const [ride,     setRide]     = useState<UpcomingRide | null>(null);
  const [visible,  setVisible]  = useState(false);
  const [minsLeft, setMinsLeft] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!user?.id || !user?.role) return;
    checkUpcomingRide();
    const interval = setInterval(checkUpcomingRide, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  const checkUpcomingRide = async () => {
    try {
      const endpoint = user?.role === 'driver'
        ? `/rides/activity/driver/${user.id}`
        : `/rides/activity/passenger/${user.id}`;
      const res = await api.get(endpoint);
      const rides: UpcomingRide[] = res?.data?.data || [];
      const now = Date.now();
      const upcoming = rides.find(r => {
        if (!['ACCEPTED', 'IN_PROGRESS'].includes(r.status)) return false;
        const diff = new Date(r.dateDepart).getTime() - now;
        return diff > 0 && diff <= REMINDER_WINDOW_MS;
      });
      if (upcoming) {
        // ← skip if already shown for this ride
        if (reminderShownForRideId === upcoming.rideId) return;
        const diff = new Date(upcoming.dateDepart).getTime() - now;
        setMinsLeft(Math.round(diff / 60000));
        setRide(upcoming);
        setVisible(true);
        reminderShownForRideId = upcoming.rideId; // ← mark as shown
      }
    } catch { }
  };

  const handleGoToRide = () => {
    setVisible(false);
    if (!ride) return;
    const route = user?.role === 'driver'
      ? '/(driverTabs)/MesTrajets'
      : '/(passengerTabs)/MesTrajets';
    router.push({
      pathname: route as any,
      params: { rideId: String(ride.rideId), highlight: 'true' },
    });
  };

  if (!ride) return null;

  const otherPerson  = user?.role === 'driver' ? ride.passenger : ride.driver;
  const urgencyLabel = minsLeft <= 5
    ? 'Starting now!'
    : minsLeft <= 15
    ? 'Get ready, very soon!'
    : minsLeft <= 30
    ? 'Start preparing'
    : 'You still have some time';

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>

          <View style={s.iconCircle}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Ionicons name="time" size={32} color="#111" />
            </Animated.View>
          </View>

          <Text style={s.title}>Ride reminder</Text>
          <Text style={s.subtitle}>
            Your ride starts {minsLeft <= 5 ? 'now' : `in ${minsLeft} minutes`}
          </Text>

          <View style={s.urgencyBadge}>
            <Ionicons name="alert-circle-outline" size={14} color="#374151" />
            <Text style={s.urgencyText}>{urgencyLabel}</Text>
          </View>

          <View style={s.routeBox}>
            <View style={s.routeRow}>
              <View style={[s.dot, { backgroundColor: '#22C55E' }]} />
              <Text style={s.routeText} numberOfLines={1}>{ride.startAddress}</Text>
            </View>
            <View style={s.routeLine} />
            <View style={s.routeRow}>
              <View style={[s.dot, { backgroundColor: '#EF4444' }]} />
              <Text style={s.routeText} numberOfLines={1}>{ride.endAddress}</Text>
            </View>
          </View>

          <View style={s.infoRow}>
            <Ionicons name="time-outline" size={14} color="#9CA3AF" />
            <Text style={s.infoText}>
              {ride.heureDepart || new Date(ride.dateDepart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {otherPerson && (
            <View style={s.infoRow}>
              <Ionicons name="person-outline" size={14} color="#9CA3AF" />
              <Text style={s.infoText}>
                {user?.role === 'driver' ? 'Passenger' : 'Driver'}: {otherPerson.prenom} {otherPerson.nom}
              </Text>
            </View>
          )}

          <View style={s.actions}>
            <TouchableOpacity style={s.dismissBtn} onPress={() => setVisible(false)}>
              <Text style={s.dismissText}>Later</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.trackBtn} onPress={handleGoToRide}>
              <Ionicons name="navigate-outline" size={16} color="#fff" />
              <Text style={s.trackBtnText}>Track ride</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, width: SW, height: SH,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24,
    width: '100%', alignItems: 'center', gap: 12,
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#F5F5F5', borderWidth: 1.5, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title:    { fontSize: 20, fontWeight: '800', color: '#111', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  urgencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    width: '100%', justifyContent: 'center',
  },
  urgencyText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  routeBox:  { backgroundColor: '#F7F7F7', borderRadius: 14, padding: 14, gap: 4, width: '100%' },
  routeRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot:       { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 2, height: 14, backgroundColor: '#E5E7EB', marginLeft: 4 },
  routeText: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '600' },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  infoText: { fontSize: 13, color: '#6B7280' },
  actions:     { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  dismissBtn:  { flex: 1, borderRadius: 12, paddingVertical: 14, backgroundColor: '#F5F5F5', alignItems: 'center' },
  dismissText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  trackBtn:    { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#111', borderRadius: 12, paddingVertical: 14 },
  trackBtnText:{ fontSize: 15, fontWeight: '700', color: '#fff' },
});