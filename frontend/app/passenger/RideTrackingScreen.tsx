import { useEffect, useState, useRef, useContext, useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useLocalSearchParams, router } from 'expo-router';
import { useRide } from '../../context/RideContext';
import { initSocket } from '../../services/socket';
import { LocationContext } from '../../context/LocationContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { haversine } from '../../utils/geoUtils';

const toValidCoord = (lat: any, lng: any) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
};

export default function RideTrackingScreen() {
  const { trajetId } = useLocalSearchParams<{ trajetId: string }>();
  const { listenToRideStatus, getRideById, getDriverLocationForRide } = useRide();
  const { currentLocation } = useContext(LocationContext);

  const [status, setStatus] = useState<string>('IN_PROGRESS');
  const [loading, setLoading] = useState<boolean>(true);

  const [ride, setRide] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  const driverMarkerRef = useRef<any>(null);
  const mapRef = useRef<MapView | null>(null);
  const hasAutoFittedRef = useRef(false);

  useEffect(() => {
    if (!trajetId) return;
    const cachedDriverLocation = getDriverLocationForRide(trajetId);
    if (cachedDriverLocation) {
      setDriverLocation(cachedDriverLocation);
    }
  }, [trajetId, getDriverLocationForRide]);

  // load ride data once
  useEffect(() => {
    if (!trajetId) return;
    getRideById(trajetId)
     .then((r: any) => {
      setRide(r);
      setStatus(r?.status || 'ACCEPTED');
   })
    .catch((e: any) => console.error('fetch ride failed', e))
    .finally(() => setLoading(false));
  }, [trajetId, getRideById]);

  // listen status (existing polling) plus transitions
  useEffect(() => {
    if (!trajetId) return;
    const stopListening = listenToRideStatus(trajetId, (updatedRide: any) => {
      setRide(updatedRide);
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
  }, [trajetId, listenToRideStatus]);

  // websocket subscribe + receive driver coords
  useEffect(() => {
    let sock: any;
    if (!trajetId) return;
    const setup = async () => {
      try {
        sock = await initSocket();
        sock.emit('subscribeToRide', trajetId);
        console.log('📡 Passenger subscribed to ride room:', trajetId);
        sock.on('driverLocationUpdate', ({ rideId, location }: { rideId: string | number; location: { latitude: number; longitude: number } }) => {
          if (String(rideId) !== String(trajetId)) return;
          console.log('📍 Passenger received driver location:', rideId, location);
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

  const startCoord = useMemo(() => toValidCoord(ride?.startLat, ride?.startLng), [ride?.startLat, ride?.startLng]);
  const endCoord = useMemo(() => toValidCoord(ride?.endLat, ride?.endLng), [ride?.endLat, ride?.endLng]);
  const passengerCoord = useMemo(
    () => toValidCoord(currentLocation?.latitude, currentLocation?.longitude),
    [currentLocation?.latitude, currentLocation?.longitude]
  );

  const redMarker = useMemo(() => {
    if (!startCoord && !endCoord) return null;
    if (!startCoord) return { coordinate: endCoord, title: 'Destination' };
    if (!endCoord) return { coordinate: startCoord, title: 'Pickup' };
    if (!passengerCoord) return { coordinate: endCoord, title: 'Destination' };

    const dStart = haversine(passengerCoord, startCoord);
    const dEnd = haversine(passengerCoord, endCoord);
    if (dStart <= dEnd) {
      return { coordinate: endCoord, title: 'Destination' };
    }
    return { coordinate: startCoord, title: 'Pickup' };
  }, [startCoord, endCoord, passengerCoord]);

  const greenMarker = passengerCoord || startCoord;
  const polylineCoordinates = useMemo(() => {
    if (greenMarker && redMarker?.coordinate) {
      return [greenMarker, redMarker.coordinate];
    }
    if (startCoord && endCoord) {
      return [startCoord, endCoord];
    }
    return [];
  }, [greenMarker, redMarker?.coordinate, startCoord, endCoord]);

  const driverToPassengerCoordinates = useMemo(() => {
    const driverCoord = toValidCoord(driverLocation?.latitude, driverLocation?.longitude);
    if (!driverCoord || !greenMarker) return [];
    return [driverCoord, greenMarker];
  }, [driverLocation?.latitude, driverLocation?.longitude, greenMarker]);

  const initialRegion = useMemo(() => {
    const passenger = toValidCoord(currentLocation?.latitude, currentLocation?.longitude);
    const start = toValidCoord(ride?.startLat, ride?.startLng);
    const center = passenger || start || { latitude: 36.7538, longitude: 3.0588 };
    return {
      ...center,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [currentLocation?.latitude, currentLocation?.longitude, ride?.startLat, ride?.startLng]);

  useEffect(() => {
    if (!mapRef.current || !ride) return;
    if (hasAutoFittedRef.current) return;
    let points: any[] = [];

    const hasDriver = !!(driverLocation?.latitude && driverLocation?.longitude);
    const hasPassenger = !!(currentLocation?.latitude && currentLocation?.longitude);

    // For accepted rides, zoom directly on passenger + driver when both are known.
    if (status === 'ACCEPTED' && hasDriver && hasPassenger) {
      points = [driverLocation, currentLocation];
    } else {
    const start = toValidCoord(ride.startLat, ride.startLng);
    const end = toValidCoord(ride.endLat, ride.endLng);
    if (start) points.push(start);
    if (end) points.push(end);
      if (hasDriver) points.push(driverLocation);
      if (hasPassenger) points.push(currentLocation);
    }

    if (points.length >= 2) {
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 90, right: 90, bottom: 90, left: 90 },
        animated: true,
      });
      hasAutoFittedRef.current = true;
    }
  }, [ride, status, driverLocation, currentLocation]);

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
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
      >
        {redMarker?.coordinate && (
          <Marker coordinate={redMarker.coordinate} title={redMarker.title} pinColor="red" />
        )}
        {greenMarker && (
          <Marker
            coordinate={greenMarker}
            title="Vous"
            pinColor="green"
          />
        )}
        {driverLocation && (
          <Marker
            ref={driverMarkerRef}
            coordinate={driverLocation}
            title="Driver"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverIconWrap}>
              <MaterialCommunityIcons name="car" size={16} color="#fff" />
            </View>
          </Marker>
        )}
        {driverToPassengerCoordinates.length > 1 && (
          <Polyline coordinates={driverToPassengerCoordinates} strokeColor="#000000" strokeWidth={4} />
        )}
        {polylineCoordinates.length > 1 && (
          <Polyline coordinates={polylineCoordinates} strokeColor="#2563EB" strokeWidth={3} />
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
  driverIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});
