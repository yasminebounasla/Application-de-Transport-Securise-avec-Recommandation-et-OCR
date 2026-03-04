import React, { useEffect, useMemo, useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
  const { notifications, unreadCount } = useNotifications();

  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [completedRideId, setCompletedRideId] = useState<number | null>(null);


  const unreadNotifications = unreadCount; // ← plus notifications.length

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
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
      />

      {/* ✅ Plus de clearNotifications() ici */}
      <TouchableOpacity
        style={styles.notificationButton}
        onPress={() => router.push('../shared/NotificationsScreen' as any)}
      >
        <Feather name="bell" size={22} color="#000" />
        {unreadNotifications > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadNotifications}</Text>
          </View>
        )}
      </TouchableOpacity>

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
              <View style={[
                styles.statusBadge,
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

      {/* Remplace le whereToBar TouchableOpacity par ceci */}
<View style={styles.bottomSheet}>
  <View style={styles.bottomSheetHandle} />
  
  <TouchableOpacity
    style={styles.searchBar}
    onPress={() => router.push('../passenger/SearchRideScreen' as any)}
    activeOpacity={0.85}
  >
    <View style={styles.searchIconWrapper}>
      <Ionicons name="search" size={18} color="#FFF" />
    </View>
    <Text style={styles.searchText}>Where to & for how much?</Text>
    <Ionicons name="chevron-forward" size={18} color="#999" />
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
    elevation: 10,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'red',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  activeTripsContainer: {
    position: 'absolute',
    top: 70,
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
  tripDots: { alignItems: 'center', gap: 2 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E' },
  tripLine: { width: 2, height: 16, backgroundColor: '#ddd' },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E53E3E' },
  tripInfo: { flex: 1, gap: 4 },
  tripText: { fontSize: 13, fontWeight: '600', color: '#111' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeActive: { backgroundColor: '#DCFCE7' },
  badgeAccepted: { backgroundColor: '#FEF9C3' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#111' },
  bottomSheet: {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: '#FFF',
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  paddingHorizontal: 16,
  paddingTop: 10,
  paddingBottom: 90, 
  shadowColor: '#000',
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.12,
  shadowRadius: 16,
  elevation: 20,
},
bottomSheetHandle: {
  width: 36, height: 4, borderRadius: 2,
  backgroundColor: '#E0E0E0',
  alignSelf: 'center', marginBottom: 14,
},
searchBar: {
  flexDirection: 'row', alignItems: 'center',
  backgroundColor: '#F5F5F5', borderRadius: 16,
  paddingVertical: 14, paddingHorizontal: 14,
  marginBottom: 16, gap: 10,
},
searchIconWrapper: {
  width: 32, height: 32, borderRadius: 10,
  backgroundColor: '#000',
  alignItems: 'center', justifyContent: 'center',
},
searchText: { flex: 1, fontSize: 15, color: '#333', fontWeight: '500' },

});