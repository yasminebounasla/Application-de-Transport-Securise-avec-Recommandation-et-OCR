import { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import MapView, { Marker, AnimatedRegion } from 'react-native-maps';
import { useLocalSearchParams, router } from 'expo-router';
import { useRide } from '../../context/RideContext';
import { initSocket } from '../../services/socket';

// simple haversine distance (km)
const haversine = (a, b) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
};

export default function RideTrackingScreen() {
  const { trajetId } = useLocalSearchParams<{ trajetId: string }>();
  const { listenToRideStatus, getRideById } = useRide();

  const [status, setStatus] = useState<string>('IN_PROGRESS');
  const [loading, setLoading] = useState<boolean>(true);

  const [ride, setRide] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  const driverMarkerRef = useRef(null);
  const regionRef = useRef(new AnimatedRegion({
    latitude: 0,
    longitude: 0,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  }));

  // load ride data once
  useEffect(() => {
    if (!trajetId) return;
    getRideById(trajetId)
      .then((r) => {
        setRide(r);
      })
      .catch((e) => console.error('fetch ride failed', e));
  }, [trajetId]);

  // listen status (existing polling) plus transitions
  useEffect(() => {
    if (!trajetId) return;
    const stopListening = listenToRideStatus(trajetId, (updatedRide: any) => {
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

  // websocket subscribe + receive driver coords
  useEffect(() => {
    let sock;
    if (!trajetId) return;
    const setup = async () => {
      try {
        sock = await initSocket();
        sock.emit('subscribeToRide', trajetId);
        sock.on('driverLocationUpdate', ({ rideId, location }) => {
          if (rideId !== trajetId) return;
          setDriverLocation(location);
        });
      } catch (err) {
        console.warn('socket error', err);
      }
    };
    setup();
    return () => {
      if (sock) {
        sock.off('driverLocationUpdate');
      }
    };
  }, [trajetId]);

  // animate marker and compute ETA when driverLocation changes
  useEffect(() => {
    if (driverLocation && driverMarkerRef.current) {
      driverMarkerRef.current.animateMarkerToCoordinate(driverLocation, 500);
    }
    if (driverLocation && ride && ride.startLat && ride.startLng) {
      const dist = haversine(driverLocation, { latitude: ride.startLat, longitude: ride.startLng });
      const speed = 40; // km/h assume
      const mins = Math.round((dist / speed) * 60);
      setEtaMinutes(mins);
    }
  }, [driverLocation, ride]);

  if (loading || !ride) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Loading ride...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={regionRef}
        style={styles.map}
        initialRegion={{
          latitude: ride.startLat || 0,
          longitude: ride.startLng || 0,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {ride.startLat && ride.startLng && (
          <Marker coordinate={{ latitude: ride.startLat, longitude: ride.startLng }} title="Pickup" />
        )}
        {driverLocation && (
          <Marker
            ref={driverMarkerRef}
            coordinate={driverLocation}
            pinColor="blue"
            title="Driver"
          />
        )}
      </MapView>
      <View style={styles.infoContainer}>
        <Text>Status: {status}</Text>
        {etaMinutes !== null && <Text>ETA: {etaMinutes} min</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: { marginTop: 20, fontSize: 16, color: '#666' },
  infoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 10,
    borderRadius: 8,
  },
});