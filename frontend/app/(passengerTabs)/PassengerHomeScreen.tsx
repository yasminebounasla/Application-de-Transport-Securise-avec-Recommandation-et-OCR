import React, { useEffect, useMemo, useState, useContext, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import FeedbackModal from '../../components/FeedbackModal';
import { useRide } from '../../context/RideContext';
import { LocationContext } from '../../context/LocationContext';
import { useNotifications } from '../../context/NotificationContext';
import MapView from 'react-native-maps';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';

const FEEDBACK_REQUESTED_KEY = 'feedback_requested_rides';

export default function Home() {
  const { getPassengerRides, passengerRides } = useRide();
  const { currentLocation } = useContext(LocationContext);
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 60 + insets.bottom;

  const mapRef = useRef<MapView>(null);

  const feedbackCheckedRef = useRef<Set<number>>(new Set());

  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [completedRideId, setCompletedRideId] = useState<number | null>(null);

  useEffect(() => { getPassengerRides(); }, []);

  const isFeedbackRequested = async (rideId: number): Promise<boolean> => {
    try {
      const requestedRides = await AsyncStorage.getItem(FEEDBACK_REQUESTED_KEY);
      if (!requestedRides) return false;
      return JSON.parse(requestedRides).includes(rideId);
    } catch { return false; }
  };

  const markFeedbackAsRequested = async (rideId: number) => {
    try {
      const requestedRides = await AsyncStorage.getItem(FEEDBACK_REQUESTED_KEY);
      const ridesArray = requestedRides ? JSON.parse(requestedRides) : [];
      if (!ridesArray.includes(rideId)) {
        ridesArray.push(rideId);
        await AsyncStorage.setItem(FEEDBACK_REQUESTED_KEY, JSON.stringify(ridesArray));
      }
    } catch (error) { console.error('Erreur sauvegarde feedback:', error); }
  };

useEffect(() => {
    const handleRides = async () => {
      if (passengerRides.length === 0) return;
      const completedRide = passengerRides.find((ride: any) => ride.status === 'COMPLETED');
      if (!completedRide) return;
      if (feedbackCheckedRef.current.has(completedRide.id)) return;
      feedbackCheckedRef.current.add(completedRide.id);
      try {
        const alreadyRequested = await isFeedbackRequested(completedRide.id);
        if (alreadyRequested) return;
        const response = await api.get(`/feedback/trajet/${completedRide.id}`);
        if (response.data.data.length === 0) {
          await markFeedbackAsRequested(completedRide.id);
          setCompletedRideId(completedRide.id);
          setShowFeedbackModal(true);
        }
      } catch (err) { console.error('Erreur check feedback:', err); }
    };
    handleRides();
  }, [passengerRides]);

  const activeTrips = useMemo(() =>
    (passengerRides || []).filter(
      (ride: any) => ride.status === 'ACCEPTED' || ride.status === 'IN_PROGRESS',
    ), [passengerRides]);

  const initialRegion = {
    latitude:  currentLocation?.latitude  ?? 36.7538,
    longitude: currentLocation?.longitude ?? 3.0588,
    latitudeDelta:  0.05,
    longitudeDelta: 0.05,
  };

  const goToCurrentLocation = () => {
    if (!currentLocation) return;
    mapRef.current?.animateToRegion({
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 500);
  };

  return (
    <>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
      />

      {/* Notification bell — top right */}
      <TouchableOpacity
        style={styles.notificationButton}
        onPress={() => router.push('../shared/NotificationsScreen' as any)}
      >
        <Feather name="bell" size={22} color="#000" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Locate button — floating on map, bottom-right just above the sheet */}
      <TouchableOpacity
        style={[styles.locationButton, { bottom: TAB_BAR_HEIGHT + 120 }]}
        onPress={goToCurrentLocation}
        activeOpacity={0.8}
      >
        <Ionicons name="locate" size={20} color="#007AFF" />
      </TouchableOpacity>

      {/* Active trips */}
      {activeTrips.length > 0 && (
        <View style={styles.activeTripsContainer}>
          {activeTrips.slice(0, 2).map((trip: any) => (
            <View key={trip.id} style={styles.tripCard}>
              <View style={styles.tripDots}>
                <View style={styles.dotGreen} />
                <View style={styles.tripLine} />
                <View style={styles.dotRed} />
              </View>
              <View style={styles.tripInfo}>
                <Text style={styles.tripText} numberOfLines={1}>{trip.startAddress || 'Départ'}</Text>
                <Text style={styles.tripText} numberOfLines={1}>{trip.endAddress   || 'Destination'}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                trip.status === 'IN_PROGRESS' ? styles.badgeActive : styles.badgeAccepted,
              ]}>
                <Text style={styles.statusText}>
                  {trip.status === 'IN_PROGRESS' ? 'En cours' : 'Accepté'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Bottom Sheet ── */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 5 }]}>
        <View style={styles.bottomSheetHandle} />

        <Text style={styles.sectionTitle}>Pick your destination</Text>

        <TouchableOpacity
          style={styles.darkCard}
          onPress={() => router.push('../passenger/SearchRideScreen' as any)}
          activeOpacity={0.88}
        >
          <View style={styles.glowOrb} />

          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Where are you heading?</Text>
            <Text style={styles.cardSub}>Tap to set your destination</Text>
          </View>

          <View style={styles.starBadge}>
            <Text style={styles.starIcon}>✦</Text>
            <Text style={styles.starText}>Ready</Text>
          </View>
        </TouchableOpacity>
      </View>

      <FeedbackModal
        visible={showFeedbackModal}
        trajetId={completedRideId}
        onClose={() => { setShowFeedbackModal(false); setCompletedRideId(null); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  notificationButton: {
    position: 'absolute', top: 16, right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 10,
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#E53E3E', borderRadius: 8,
    width: 16, height: 16, justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  locationButton: {
    position: 'absolute',
    right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 30,
    zIndex: 999,
  },

  activeTripsContainer: { position: 'absolute', top: 70, left: 16, right: 16, gap: 8 },
  tripCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10, shadowRadius: 8, elevation: 5,
  },
  tripDots: { alignItems: 'center', gap: 2 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E' },
  tripLine: { width: 2, height: 16, backgroundColor: '#DDD' },
  dotRed:   { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E53E3E' },
  tripInfo: { flex: 1, gap: 4 },
  tripText: { fontSize: 13, fontWeight: '600', color: '#111' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeActive:   { backgroundColor: '#DCFCE7' },
  badgeAccepted: { backgroundColor: '#FEF9C3' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#111' },

  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 20, elevation: 20,
  },
  bottomSheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center', marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 24, fontWeight: '800', color: '#0A0A0A',
    letterSpacing: -0.6, marginBottom: 14,
  },

  darkCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16,
    overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  glowOrb: {
    position: 'absolute', top: -20, right: -20,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  starBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
  },
  starIcon: { fontSize: 9, color: 'rgba(255,255,255,0.7)' },
  starText: {
    fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  cardSub: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '400', marginTop: 2 },
});