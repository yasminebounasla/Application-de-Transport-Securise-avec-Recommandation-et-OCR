import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, Dimensions, Animated,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const { width: SW } = Dimensions.get('window');

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

const REMINDER_WINDOW_MS = 60 * 60 * 1000; // 1 heure

export default function ReminderModal() {
  const { user } = useAuth();
  const [ride, setRide]       = useState<UpcomingRide | null>(null);
  const [visible, setVisible] = useState(false);
  const [minsLeft, setMinsLeft] = useState(0);
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    if (!user?.id) return;
    checkUpcomingRide();
  }, [user?.id]);

  // Animation pulse sur l'icône horloge
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
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

      // Chercher un trajet ACCEPTED ou IN_PROGRESS dans moins d'1h
      const now = Date.now();
      const upcoming = rides.find(r => {
        if (!['ACCEPTED', 'IN_PROGRESS', 'PENDING'].includes(r.status)) return false;
        const departure = new Date(r.dateDepart).getTime();
        const diff = departure - now;
        return diff > 0 && diff <= REMINDER_WINDOW_MS;
      });

      if (upcoming) {
        const diff    = new Date(upcoming.dateDepart).getTime() - now;
        const mins    = Math.round(diff / 60000);
        setMinsLeft(mins);
        setRide(upcoming);
        setVisible(true);
      }
    } catch (e) {
      // Silently fail — reminder is non-critical
    }
  };

  const handleGoToRide = () => {
    setVisible(false);
    if (!ride) return;
    const route = user?.role === 'driver'
      ? '/(driverTabs)/Activity'
      : '/(passengerTabs)/Activity';
    router.push({
      pathname: route as any,
      params: { rideId: String(ride.rideId), tab: 'pending' },
    });
  };

  if (!ride) return null;

  const otherPerson = user?.role === 'driver'
    ? ride.passenger
    : ride.driver;

  const urgencyColor = minsLeft <= 15 ? '#EF4444' : minsLeft <= 30 ? '#F59E0B' : '#3B82F6';

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={s.overlay}>
        <View style={s.card}>

          {/* Header */}
          <View style={[s.headerBar, { backgroundColor: urgencyColor }]}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Ionicons name="time" size={22} color="#fff" />
            </Animated.View>
            <Text style={s.headerText}>
              {minsLeft <= 15 ? '⚡ Très bientôt !' : `Dans ${minsLeft} minutes`}
            </Text>
          </View>

          {/* Title */}
          <View style={s.body}>
            <Text style={s.title}>Rappel de trajet</Text>
            <Text style={s.subtitle}>
              Votre trajet commence {minsLeft <= 5 ? 'maintenant' : `dans ${minsLeft} min`}
            </Text>

            {/* Trajet */}
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

            {/* Infos */}
            <View style={s.infoRow}>
              <MaterialIcons name="schedule" size={15} color="#666" />
              <Text style={s.infoText}>{ride.heureDepart || new Date(ride.dateDepart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>

            {otherPerson && (
              <View style={s.infoRow}>
                <MaterialIcons name="person" size={15} color="#666" />
                <Text style={s.infoText}>
                  {user?.role === 'driver' ? 'Passager' : 'Conducteur'} : {otherPerson.prenom} {otherPerson.nom}
                </Text>
              </View>
            )}

            {/* Badge urgence */}
            <View style={[s.urgenceBadge, { backgroundColor: urgencyColor + '20', borderColor: urgencyColor }]}>
              <Text style={[s.urgenceText, { color: urgencyColor }]}>
                {minsLeft <= 15
                  ? '🔴 Préparez-vous, c\'est imminent !'
                  : minsLeft <= 30
                    ? '🟡 Pensez à vous préparer'
                    : '🔵 Vous avez encore un peu de temps'}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity style={s.dismissBtn} onPress={() => setVisible(false)}>
              <Text style={s.dismissText}>Plus tard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.viewBtn, { backgroundColor: urgencyColor }]} onPress={handleGoToRide}>
              <MaterialIcons name="directions-car" size={16} color="#fff" />
              <Text style={s.viewText}>Voir le trajet</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  card:         { width: '100%', backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden' },
  headerBar:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14 },
  headerText:   { color: '#fff', fontSize: 16, fontWeight: '800' },
  body:         { padding: 20, gap: 12 },
  title:        { fontSize: 20, fontWeight: '800', color: '#111' },
  subtitle:     { fontSize: 14, color: '#666' },
  routeBox:     { backgroundColor: '#F7F7F7', borderRadius: 14, padding: 14, gap: 4 },
  routeRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot:          { width: 10, height: 10, borderRadius: 5 },
  routeLine:    { width: 2, height: 14, backgroundColor: '#DDD', marginLeft: 4 },
  routeText:    { flex: 1, fontSize: 13, color: '#333', fontWeight: '600' },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText:     { fontSize: 13, color: '#555' },
  urgenceBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  urgenceText:  { fontSize: 13, fontWeight: '600' },
  actions:      { flexDirection: 'row', gap: 10, padding: 16, paddingTop: 4 },
  dismissBtn:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#F5F5F5' },
  dismissText:  { fontSize: 14, fontWeight: '600', color: '#666' },
  viewBtn:      { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  viewText:     { fontSize: 14, fontWeight: '700', color: '#fff' },
});