import React, { useEffect, useMemo, useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import FeedbackModal from '../../components/FeedbackModal';
import { useRide } from '../../context/RideContext';
import { LocationContext } from '../../context/LocationContext';
import { useNotifications } from '../../context/NotificationContext';
import MapView from 'react-native-maps';
import { Ionicons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';

const FEEDBACK_REQUESTED_KEY = 'feedback_requested_rides';

export default function Home() {
  const { getPassengerRides, passengerRides } = useRide();
  const { currentLocation } = useContext(LocationContext);
  const { unreadCount } = useNotifications();

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
      if (completedRide) {
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
      }
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
    latitudeDelta:  0.01,
    longitudeDelta: 0.01,
  };

  return (
    <>
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
      />

      {/* Notification bell */}
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
              <View style={[styles.statusBadge, trip.status === 'IN_PROGRESS' ? styles.badgeActive : styles.badgeAccepted]}>
                <Text style={styles.statusText}>{trip.status === 'IN_PROGRESS' ? 'En cours' : 'Accepté'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Bottom Sheet ── */}
      <View style={styles.bottomSheet}>
        <View style={styles.bottomSheetHandle} />

        {/* Title */}
        <Text style={styles.sectionTitle}>Where to?</Text>
        <Text style={styles.sectionSubtitle}>Pick your destination</Text>

        {/* Single unified search bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push('../passenger/SearchRideScreen' as any)}
          activeOpacity={0.8}
        >
          {/* Left icon */}
          <View style={styles.searchIconWrap}>
            <Ionicons name="search" size={18} color="#FFF" />
          </View>

          {/* Text */}
          <Text style={styles.searchPlaceholder}>Search a destination...</Text>

          {/* Right arrow */}
          <View style={styles.arrowWrap}>
            <Ionicons name="arrow-forward" size={16} color="#555" />
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
  /* Notification */
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

  /* Active trips */
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

  /* ── Bottom Sheet ── */
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 100 : 90,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 20, elevation: 20,
  },
  bottomSheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center', marginBottom: 18,
  },

  /* Title */
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0A0A0A',
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 22,
    color: '#0A0A0A',
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 16,
  },

  /* Search bar */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#ECECEC',
  },
  searchIconWrap: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: '#0A0A0A',
    alignItems: 'center', justifyContent: 'center',
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: '#AEAEAE',
    fontWeight: '500',
  },
  arrowWrap: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#ECECEC',
    alignItems: 'center', justifyContent: 'center',
  },
});