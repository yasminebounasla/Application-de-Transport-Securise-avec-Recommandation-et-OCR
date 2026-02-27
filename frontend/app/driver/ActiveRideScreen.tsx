import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRide } from '../../context/RideContext';
import { initSocket } from '../../services/socket';

export default function ActiveRideScreen() {
  const { driverRequests, completeRide } = useRide();

  const activeRide = driverRequests?.find(
    (r) => r.status === 'ACCEPTED' || r.status === 'IN_PROGRESS'
  );

  const [currentLocation, setCurrentLocation] = useState(null);
  const watchRef = useRef(null);
  const socketRef = useRef(null);
  const mapRef = useRef(null);

  // initialise socket + location tracking when ride is available
  useEffect(() => {
    let unsub = null;
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

      unsub = await Location.watchPositionAsync(
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
      if (unsub) unsub.remove();
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [activeRide]);

  // center map when locations available
  useEffect(() => {
    if (mapRef.current && activeRide) {
      const coords = [];
      if (activeRide.startLat && activeRide.startLng) {
        coords.push({ latitude: activeRide.startLat, longitude: activeRide.startLng });
      }
      if (activeRide.endLat && activeRide.endLng) {
        coords.push({ latitude: activeRide.endLat, longitude: activeRide.endLng });
      }
      if (coords.length) {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 100, right: 100, bottom: 200, left: 100 },
          animated: true,
        });
      }
    }
  }, [activeRide]);

  const handleFinish = async () => {
    if (!activeRide) return;
    try {
      await completeRide(activeRide.id);
      Alert.alert('Succès', 'Trajet terminé');
    } catch (err) {
      console.error('Finish error', err);
      Alert.alert('Erreur', 'Impossible de terminer le trajet');
    }
  };

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
        initialRegion={{
          latitude: currentLocation?.latitude || activeRide.startLat || 0,
          longitude: currentLocation?.longitude || activeRide.startLng || 0,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {activeRide.startLat && activeRide.startLng && (
          <Marker
            coordinate={{
              latitude: activeRide.startLat,
              longitude: activeRide.startLng,
            }}
            title="Départ"
          />
        )}
        {activeRide.endLat && activeRide.endLng && (
          <Marker
            coordinate={{
              latitude: activeRide.endLat,
              longitude: activeRide.endLng,
            }}
            title="Arrivée"
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
              strokeColor="red"
            />
          )}
      </MapView>
      <View style={styles.buttonContainer}>
        <Button title="Terminer" onPress={handleFinish} />
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
    bottom: 20,
    left: 20,
    right: 20,
  },
});
