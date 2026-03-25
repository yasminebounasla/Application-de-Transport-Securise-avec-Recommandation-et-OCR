import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRide } from '../../context/RideContext';
import { initSocket } from '../../services/socket';

const NEAR_DISTANCE_M = 200;

const distanceMeters = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) => {
  // Haversine formula.
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
};

export default function ActiveRideScreen() {
  const { trajetId } = useLocalSearchParams<{ trajetId?: string }>();
  const insets = useSafeAreaInsets();
  const {
    driverRequests,
    currentRide,
    getDriverActiveRide,
    getRideById,
    startRide,
    completeRide,
  } = useRide();

  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [selectedRideLoading, setSelectedRideLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(null);

  const socketRef = useRef<any>(null);
  const mapRef = useRef<MapView | null>(null);
  const userInteractedWithMapRef = useRef(false);
  const autoFittedOnceRef = useRef(false);

  useEffect(() => {
    getDriverActiveRide();
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadSelectedRide = async () => {
      if (!trajetId) {
        setSelectedRide(null);
        return;
      }
      setSelectedRideLoading(true);
      try {
        const ride = await getRideById(trajetId);
        if (mounted) setSelectedRide(ride);
      } catch (err) {
        console.error('Load selected ride failed:', err);
      } finally {
        if (mounted) setSelectedRideLoading(false);
      }
    };
    loadSelectedRide();
    return () => {
      mounted = false;
    };
  }, [trajetId]);

  const syncedSelectedRide =
    selectedRide && currentRide && selectedRide.id === currentRide.id
      ? currentRide
      : selectedRide;

  const activeRide =
    syncedSelectedRide ||
    (currentRide && (currentRide.status === 'ACCEPTED' || currentRide.status === 'IN_PROGRESS')
      ? currentRide
      : null) ||
    driverRequests?.find((r: any) => r.status === 'ACCEPTED' || r.status === 'IN_PROGRESS' || r.status === 'PENDING');

  useEffect(() => {
    let subscription: any = null;

    const setup = async () => {
      if (!activeRide) return;

      try {
        const sock = await initSocket();
        socketRef.current = sock;
        sock.emit('subscribeToRide', activeRide.id);
      } catch (err) {
        console.warn('Socket init failed', err);
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission', 'Location permission is required to track ride');
        return;
      }

      try {
        const firstLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const initialCoords = {
          latitude: firstLocation.coords.latitude,
          longitude: firstLocation.coords.longitude,
        };
        setCurrentLocation(initialCoords);

        if (socketRef.current && activeRide?.id) {
          socketRef.current.emit('driverLocationUpdate', {
            rideId: activeRide.id,
            location: initialCoords,
          });
        }
      } catch (err) {
        console.warn('Initial location read failed:', err);
      }

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => {
          const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setCurrentLocation(coords);

          if (socketRef.current && activeRide?.id) {
            socketRef.current.emit('driverLocationUpdate', {
              rideId: activeRide.id,
              location: coords,
            });
          }
        }
      );
    };

    setup();

    return () => {
      if (subscription) subscription.remove();
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [activeRide]);

  useEffect(() => {
    if (!mapRef.current || !activeRide) return;
    if (userInteractedWithMapRef.current) return;
    if (autoFittedOnceRef.current) return;

    const coords: any[] = [];
    if (activeRide.startLat && activeRide.startLng) {
      coords.push({ latitude: activeRide.startLat, longitude: activeRide.startLng });
    }
    if (activeRide.endLat && activeRide.endLng) {
      coords.push({ latitude: activeRide.endLat, longitude: activeRide.endLng });
    }
    if (currentLocation?.latitude && currentLocation?.longitude) {
      coords.push(currentLocation);
    }
    if (coords.length >= 2) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 90, right: 90, bottom: 180, left: 90 },
        animated: true,
      });
      autoFittedOnceRef.current = true;
    }
  }, [activeRide, currentLocation]);

  // Reset auto-fit when switching to another ride.
  useEffect(() => {
    userInteractedWithMapRef.current = false;
    autoFittedOnceRef.current = false;
  }, [activeRide?.id]);

  const handleStart = async () => {
    if (!activeRide) return;

    if (!currentLocation?.latitude || !currentLocation?.longitude) {
      Alert.alert('Erreur', 'Localisation indisponible.');
      return;
    }

    if (activeRide.startLat && activeRide.startLng) {
      const meters = distanceMeters(
        currentLocation,
        { latitude: activeRide.startLat, longitude: activeRide.startLng }
      );
      if (meters > NEAR_DISTANCE_M) {
        Alert.alert('You didn\'t pickup the passenger');
        return;
      }
    }

    try {
      const startedRide = await startRide(activeRide.id);
      setSelectedRide(startedRide);
      Alert.alert('Trip started');
      getDriverActiveRide();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Impossible de demarrer le trajet';
      console.error('Start error', err);
      Alert.alert('Erreur', msg);
    }
  };

  const handleFinish = async () => {
    if (!activeRide) return;

    if (!currentLocation?.latitude || !currentLocation?.longitude) {
      Alert.alert('Erreur', 'Localisation indisponible.');
      return;
    }

    if (activeRide.endLat && activeRide.endLng) {
      const meters = distanceMeters(
        currentLocation,
        { latitude: activeRide.endLat, longitude: activeRide.endLng }
      );
      if (meters > NEAR_DISTANCE_M) {
        Alert.alert('You didn\'t reach the destination yet');
        return;
      }
    }

    try {
      const completedRide = await completeRide(activeRide.id);
      setSelectedRide(completedRide);
      Alert.alert('Trip Ended');
      getDriverActiveRide();
      router.replace('/(driverTabs)/DriverHomeScreen' as any);
    } catch (err) {
      const anyErr: any = err;
      const msg = anyErr?.response?.data?.message || anyErr?.message || 'Impossible de terminer le trajet';
      console.error('Finish error', err);
      Alert.alert('Erreur', msg);
    }
  };

  if (selectedRideLoading) {
    return (
      <View style={styles.center}>
        <Text>Chargement du trajet...</Text>
      </View>
    );
  }

  if (!activeRide) {
    return (
      <View style={styles.center}>
        <Text>Aucun trajet actif.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        onTouchStart={() => {
          userInteractedWithMapRef.current = true;
        }}
        onRegionChangeComplete={(_, details: any) => {
          if (details?.isGesture) userInteractedWithMapRef.current = true;
        }}
        initialRegion={{
          latitude: currentLocation?.latitude || activeRide.startLat || 36.7538,
          longitude: currentLocation?.longitude || activeRide.startLng || 3.0588,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
      >
        {activeRide.startLat && activeRide.startLng && (
          <Marker
            coordinate={{
              latitude: activeRide.startLat,
              longitude: activeRide.startLng,
            }}
            title="Passenger"
            pinColor="green"
          />
        )}

        {activeRide.endLat && activeRide.endLng && (
          <Marker
            coordinate={{
              latitude: activeRide.endLat,
              longitude: activeRide.endLng,
            }}
            title="Destination"
            pinColor="red"
          />
        )}

        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            pinColor="blue"
            title="Vous"
          />
        )}

        {activeRide.startLat &&
          activeRide.startLng &&
          activeRide.endLat &&
          activeRide.endLng && (
            <Polyline
              coordinates={[
                { latitude: activeRide.startLat, longitude: activeRide.startLng },
                { latitude: activeRide.endLat, longitude: activeRide.endLng },
              ]}
              strokeWidth={4}
              strokeColor="#2563EB"
            />
          )}

        {currentLocation &&
          activeRide.startLat &&
          activeRide.startLng && (
            <Polyline
              coordinates={[
                { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
                { latitude: activeRide.startLat, longitude: activeRide.startLng },
              ]}
              strokeWidth={4}
              strokeColor="#000000"
            />
          )}
      </MapView>

      <View style={[styles.buttonContainer, { bottom: insets.bottom + 60 }]}>
        {activeRide.status === 'ACCEPTED' ? (
          <Button title="Demarrer" onPress={handleStart} />
        ) : (
          <Button title="Terminer" onPress={handleFinish} disabled={activeRide.status !== 'IN_PROGRESS'} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
});
