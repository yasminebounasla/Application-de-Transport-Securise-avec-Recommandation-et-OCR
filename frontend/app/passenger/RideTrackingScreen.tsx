import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useRide } from '../../context/RideContext';

export default function RideTrackingScreen() {
  const { trajetId } = useLocalSearchParams<{ trajetId: string }>();
  const { listenToRideStatus } = useRide();
  
  const [status, setStatus] = useState<string>('IN_PROGRESS');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!trajetId) return;

    console.log('Tracking ride ID:', trajetId);

    const stopListening = listenToRideStatus(trajetId, (updatedRide: any) => {

      console.log(' Nouveau statut:', updatedRide.status);
      setStatus(updatedRide.status);
      setLoading(false);

      if (updatedRide.status === 'COMPLETED') {
        stopListening();
        router.replace('/passenger/HomeScreen' as any);
      }
    });

    return () => {
      stopListening();
    };
  }, [trajetId]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Loading ride...</Text>
      </View>
    );
  }

  return (
    <View style={styles.centerContainer}>
      <Text style={styles.title}>Ride Tracking</Text>
      <Text style={styles.status}>Status: {status}</Text>
      <Text style={styles.rideId}>Ride ID: {trajetId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#000',
  },
  status: {
    fontSize: 20,
    marginTop: 30,
    color: '#333',
  },
  rideId: {
    color: '#999',
    marginTop: 10,
    fontSize: 14,
  },
});