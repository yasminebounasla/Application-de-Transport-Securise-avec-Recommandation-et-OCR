import { View, ScrollView, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import FeedbackModal from '../../components/FeedbackModal';
import { useEffect, useMemo, useState } from 'react';
import { useRide } from '../../context/RideContext';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';

const API_URL = "http://192.168.1.69:5000/api";
const FEEDBACK_REQUESTED_KEY = 'feedback_requested_rides';

export default function Home() {
  const { getPassengerRides, passengerRides } = useRide();
  
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [completedRideId, setCompletedRideId] = useState<number | null>(null);

  useEffect(() => {
    getPassengerRides();
  }, []);

<<<<<<< HEAD
  // Vérifier si le feedback a déjà été demandé pour ce trajet (localement)
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

  // Marquer le feedback comme demandé pour ce trajet
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
=======
  useEffect(() => {
    const handleRides = async () => {
>>>>>>> b53e904 (Driver & Passenger HomeScreens + Navigation tabs (not fully complete))
      if (passengerRides.length === 0) return;

      // Ride completed
      const completedRide = passengerRides.find(
        (ride: any) => ride.status === 'COMPLETED'
      );
      
      if (completedRide) {
        try {
          // Vérifier d'abord si on a déjà demandé le feedback localement
          const alreadyRequested = await isFeedbackRequested(completedRide.id);
          if (alreadyRequested) {
            console.log("Feedback déjà demandé pour ce trajet");
            return;
          }

          // Vérifier si un feedback existe dans le backend
          const token = await AsyncStorage.getItem('token');
          const response = await axios.get(
            `${API_URL}/feedback/trajet/${completedRide.id}`,
            { headers: { Authorization: token ? `Bearer ${token}` : undefined } }
          );
          
          const feedbackExists = response.data.data.length > 0;
          
          if (!feedbackExists) {
            // Marquer comme demandé AVANT d'afficher le modal
            await markFeedbackAsRequested(completedRide.id);
            setCompletedRideId(completedRide.id);
            setShowFeedbackModal(true);
          } else {
            console.log("Feedback already submitted");
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

  const quickActions = [
    {
      label: 'Demander un trajet',
      icon: 'add-road',
      onPress: () => router.push('/passenger/DemandeTrajetScreen' as any),
    },
    {
      label: 'Chauffeurs recommandes',
      icon: 'groups',
      onPress: () => router.push('/passenger/RecommendedDriversScreen' as any),
    },
    {
      label: 'Historique',
      icon: 'history',
      onPress: () => router.push('/passenger/HistoryScreen' as any),
    },
  ];

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => router.push('/passenger/SearchRideScreen' as any)}
        >
          <MaterialIcons name="search" size={22} color="#fff" />
          <Text style={styles.searchButtonText}>Rechercher un trajet</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trajets en cours</Text>
          {activeTrips.length === 0 ? (
            <Text style={styles.emptyText}>Aucun trajet en cours.</Text>
          ) : (
            activeTrips.slice(0, 3).map((trip: any) => (
              <View key={trip.id} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {trip.startAddress || 'Depart'} -> {trip.endAddress || 'Destination'}
                </Text>
                <Text style={styles.cardSubtitle}>Statut: {trip.status}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Navigation rapide</Text>
          <View style={styles.grid}>
            {quickActions.map((action) => (
              <TouchableOpacity key={action.label} style={styles.quickCard} onPress={action.onPress}>
                <MaterialIcons name={action.icon as any} size={24} color="#111" />
                <Text style={styles.quickText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

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
    backgroundColor: '#f7f7f8',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  searchButton: {
    backgroundColor: '#111',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  cardSubtitle: {
    marginTop: 4,
    color: '#666',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  quickCard: {
    width: '31%',
    minWidth: 92,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ececec',
  },
  quickText: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
    color: '#111',
    fontWeight: '600',
  },
});
