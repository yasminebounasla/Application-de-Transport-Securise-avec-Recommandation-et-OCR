import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import FeedbackModal from '../../components/FeedbackModal';
import { useEffect, useState, useContext } from 'react';
import { useRide } from '../../context/RideContext';
import api from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import MapView from 'react-native-maps';
import { LocationContext } from '../../context/LocationContext';

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

  const initialRegion = {
    latitude: currentLocation?.latitude ?? 36.7538,
    longitude: currentLocation?.longitude ?? 3.0588,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <>
      <View style={styles.container}>
        {/* FULL SCREEN MAP */}
        <MapView
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
        />

        {/* WHERE TO BAR (bottom) */}
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

  // Where to bar
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
