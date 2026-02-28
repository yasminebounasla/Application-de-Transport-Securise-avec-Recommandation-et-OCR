import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import FeedbackModal from '../../components/FeedbackModal';
import { useEffect, useMemo, useState, useContext } from 'react';
import { useRide } from '../../context/RideContext';
import api from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { LocationContext } from '../../context/LocationContext';
import { Feather } from '@expo/vector-icons';

const FEEDBACK_REQUESTED_KEY = 'feedback_requested_rides';

export default function Home() {
  const { getPassengerRides, passengerRides } = useRide();
  const { currentLocation } = useContext(LocationContext);

  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [completedRideId, setCompletedRideId] = useState<number | null>(null);

  useEffect(() => {
    getPassengerRides();
  }, []);

  const isFeedbackRequested = async (rideId: number): Promise<boolean> => {
    try {
      const requestedRides = await AsyncStorage.getItem(FEEDBACK_REQUESTED_KEY);
      if (!requestedRides) return false;
      const ridesArray = JSON.parse(requestedRides);
      return ridesArray.includes(rideId);
    } catch (error) {
      console.error("Erreur lecture feedback requested:", error);
      return false;
    }
  };

  const markFeedbackAsRequested = async (rideId: number) => {
    try {
      const requestedRides = await AsyncStorage.getItem(FEEDBACK_REQUESTED_KEY);
      const ridesArray = requestedRides ? JSON.parse(requestedRides) : [];
      if (!ridesArray.includes(rideId)) {
        ridesArray.push(rideId);
        await AsyncStorage.setItem(FEEDBACK_REQUESTED_KEY, JSON.stringify(ridesArray));
      }
    } catch (error) {
      console.error("Erreur sauvegarde feedback requested:", error);
    }
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
          const feedbackExists = response.data.data.length > 0;

          if (!feedbackExists) {
            await markFeedbackAsRequested(completedRide.id);
            setCompletedRideId(completedRide.id);
            setShowFeedbackModal(true);
          }
        } catch (err) {
          console.error("Erreur check feedback:", err);
        }
      }
    };
    handleRides();
  }, [passengerRides]);

  const activeTrips = useMemo(() => {
    return (passengerRides || []).filter(
      (ride: any) => ride.status === 'ACCEPTED' || ride.status === 'IN_PROGRESS',
    );
  }, [passengerRides]);

  const initialRegion = {
    latitude: currentLocation?.latitude ?? 36.7538,
    longitude: currentLocation?.longitude ?? 3.0588,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <>
      <View style={styles.container}>

        {/* Notification button */}
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push('/passenger/NotificationsScreen' as any)}
        >
          <Feather name="bell" size={22} color="#000" />
        </TouchableOpacity>


        {/* ── FULL SCREEN MAP ── */}
        <MapView
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
        />

        {/* ── ACTIVE TRIPS OVERLAY (top) ── */}
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
                  <Text style={styles.tripText} numberOfLines={1}>
                    {trip.startAddress || 'Départ'}
                  </Text>
                  <Text style={styles.tripText} numberOfLines={1}>
                    {trip.endAddress || 'Destination'}
                  </Text>
                </View>
                <View style={[styles.statusBadge,
                  trip.status === 'IN_PROGRESS' ? styles.badgeActive : styles.badgeAccepted
                ]}>
                  <Text style={styles.statusText}>
                    {trip.status === 'IN_PROGRESS' ? 'En cours' : 'Accepté'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── WHERE TO BAR (bottom) ── */}
        <TouchableOpacity
          style={styles.whereToBar}
          onPress={() => router.push('../passenger/SearchRideScreen' as any)}
          activeOpacity={0.9}
        >
          <View style={styles.whereToInner}>
            <Ionicons name="search-outline" size={20} color="#888" />
            <Text style={styles.whereToText}>Where to?</Text>
          </View>
        </TouchableOpacity>
      </View>

      <FeedbackModal
        visible={showFeedbackModal}
        trajetId={completedRideId}
        onClose={() => {
          setShowFeedbackModal(false);
          setCompletedRideId(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  notificationButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    zIndex: 1000,    
    elevation: 10
  },

  // ── Active trips ──
  activeTripsContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    gap: 8,
  },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  tripDots: {
    alignItems: 'center',
    gap: 2,
  },
  dotGreen: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#22C55E',
  },
  tripLine: {
    width: 2, height: 16,
    backgroundColor: '#ddd',
  },
  dotRed: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#E53E3E',
  },
  tripInfo: { flex: 1, gap: 4 },
  tripText: { fontSize: 13, fontWeight: '600', color: '#111' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeActive: { backgroundColor: '#DCFCE7' },
  badgeAccepted: { backgroundColor: '#FEF9C3' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#111' },

  // ── Quick actions ──
  quickActionsRow: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  quickActionBtn: {
    backgroundColor: '#fff',
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
  },

  // ── Where to bar ──
  whereToBar: {
    position: 'absolute',
    bottom: 36,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 50,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  whereToInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  whereToText: {
    fontSize: 16,
    color: '#888',
    fontWeight: '500',
  },
});