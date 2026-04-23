import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useLocalSearchParams, router } from 'expo-router';
import { useRide } from '../../context/RideContext';
import { initSocket } from '../../services/socket';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { haversine } from '../../utils/geoUtils';
import api from '../../services/api';

const toValidCoord = (lat: any, lng: any) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
};

const distanceMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
};

const approxDist2 = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  // Fast approximate distance in "degree space" (good enough for nearest-point).
  const dLat = a.latitude - b.latitude;
  const meanLatRad = ((a.latitude + b.latitude) / 2) * (Math.PI / 180);
  const dLon = (a.longitude - b.longitude) * Math.cos(meanLatRad);
  return dLat * dLat + dLon * dLon;
};

const findClosestIndex = (polyline: any[], point: { latitude: number; longitude: number }, startIndex = 0) => {
  if (!polyline.length) return 0;
  let bestIndex = Math.max(0, Math.min(startIndex, polyline.length - 1));
  let best = approxDist2(polyline[bestIndex], point);
  for (let i = bestIndex + 1; i < polyline.length; i++) {
    const d = approxDist2(polyline[i], point);
    if (d < best) {
      best = d;
      bestIndex = i;
    }
  }
  return bestIndex;
};

const geometryToPolyline = (geometry: any) => {
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates)) return [];
  return coordinates
    .map((pair: any) => {
      const lng = Array.isArray(pair) ? pair[0] : null;
      const lat = Array.isArray(pair) ? pair[1] : null;
      return toValidCoord(lat, lng);
    })
    .filter(Boolean);
};

const waypointToCoord = (waypoint: any) => {
  const loc = waypoint?.location;
  if (!Array.isArray(loc) || loc.length < 2) return null;
  return toValidCoord(loc[1], loc[0]);
};

export default function RideTrackingScreen() {
  const { trajetId } = useLocalSearchParams<{ trajetId: string }>();
  const { listenToRideStatus, getRideById, getDriverLocationForRide } = useRide();

  const [status, setStatus] = useState<string>('IN_PROGRESS');
  const [loading, setLoading] = useState<boolean>(true);

  const [ride, setRide] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [routeStartToEnd, setRouteStartToEnd] = useState<any[]>([]);
  const [routeDriverToPickup, setRouteDriverToPickup] = useState<any[]>([]);
  const [routeStartToEndWaypoints, setRouteStartToEndWaypoints] = useState<any[]>([]);
  const [routeDriverToPickupWaypoints, setRouteDriverToPickupWaypoints] = useState<any[]>([]);

  const driverMarkerRef = useRef<any>(null);
  const mapRef = useRef<MapView | null>(null);
  const hasAutoFittedRef = useRef(false);
  const hasFittedWithDriverRef = useRef(false);
  const startToEndProgressIdxRef = useRef(0);
  const lastPickupRouteFromRef = useRef<any>(null);
  const pickupRouteDebounceRef = useRef<any>(null);
  const startToEndReqIdRef = useRef(0);
  const pickupReqIdRef = useRef(0);

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

  useEffect(() => {
    // reset auto-fit when switching rides
    hasAutoFittedRef.current = false;
    hasFittedWithDriverRef.current = false;
    startToEndProgressIdxRef.current = 0;
  }, [trajetId]);

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
  const driverCoord = useMemo(
    () => toValidCoord(driverLocation?.latitude, driverLocation?.longitude),
    [driverLocation?.latitude, driverLocation?.longitude]
  );

  useEffect(() => {
    // Reset progress whenever we compute a new route or status changes.
    startToEndProgressIdxRef.current = 0;
  }, [trajetId, status, routeStartToEnd.length]);

  const remainingStartToEnd = useMemo(() => {
    if (status !== 'IN_PROGRESS') return routeStartToEnd;
    if (!driverCoord || routeStartToEnd.length < 2) return routeStartToEnd;

    // Keep progress monotonic so the line doesn't re-appear behind the car due to GPS jitter.
    const closest = findClosestIndex(routeStartToEnd, driverCoord, startToEndProgressIdxRef.current);
    const nextIdx = Math.max(startToEndProgressIdxRef.current, closest);
    startToEndProgressIdxRef.current = nextIdx;

    const tail = routeStartToEnd.slice(nextIdx);
    if (tail.length < 2) return [driverCoord];
    return [driverCoord, ...tail];
  }, [status, driverCoord?.latitude, driverCoord?.longitude, routeStartToEnd]);

  const initialRegion = useMemo(() => {
    const start = toValidCoord(ride?.startLat, ride?.startLng);
    const center = start || { latitude: 36.7538, longitude: 3.0588 };
    return {
      ...center,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [ride?.startLat, ride?.startLng]);

  // OSRM route: pickup -> destination (always, when coords exist)
  useEffect(() => {
    if (!startCoord || !endCoord) {
      setRouteStartToEnd([]);
      setRouteStartToEndWaypoints([]);
      return;
    }

    startToEndReqIdRef.current += 1;
    const reqId = startToEndReqIdRef.current;

    (async () => {
      try {
        const { data } = await api.post('/ride/calculate', { start: startCoord, end: endCoord });
        if (startToEndReqIdRef.current !== reqId) return;
        if (data?.success && data?.geometry?.coordinates) {
          setRouteStartToEnd(geometryToPolyline(data.geometry));
          const wps = Array.isArray(data?.waypoints) ? data.waypoints : [];
          const startWp = waypointToCoord(wps[0]);
          const endWp = waypointToCoord(wps[1]);
          setRouteStartToEndWaypoints([startWp, endWp].filter(Boolean));
        } else {
          setRouteStartToEnd([]);
          setRouteStartToEndWaypoints([]);
        }
      } catch (e) {
        if (startToEndReqIdRef.current !== reqId) return;
        setRouteStartToEnd([]);
        setRouteStartToEndWaypoints([]);
      }
    })();
  }, [startCoord?.latitude, startCoord?.longitude, endCoord?.latitude, endCoord?.longitude]);

  // OSRM route: driver -> pickup (only for ACCEPTED; debounced to avoid spamming)
  useEffect(() => {
    if (status !== 'ACCEPTED') {
      setRouteDriverToPickup([]);
      setRouteDriverToPickupWaypoints([]);
      lastPickupRouteFromRef.current = null;
      return;
    }

    if (!driverCoord || !startCoord) {
      setRouteDriverToPickup([]);
      setRouteDriverToPickupWaypoints([]);
      lastPickupRouteFromRef.current = null;
      return;
    }

    const last = lastPickupRouteFromRef.current;
    if (last && distanceMeters(last, driverCoord) < 50) return;

    if (pickupRouteDebounceRef.current) clearTimeout(pickupRouteDebounceRef.current);
    pickupRouteDebounceRef.current = setTimeout(async () => {
      lastPickupRouteFromRef.current = driverCoord;
      pickupReqIdRef.current += 1;
      const reqId = pickupReqIdRef.current;
      try {
        const { data } = await api.post('/ride/calculate', { start: driverCoord, end: startCoord });
        if (pickupReqIdRef.current !== reqId) return;
        if (data?.success && data?.geometry?.coordinates) {
          setRouteDriverToPickup(geometryToPolyline(data.geometry));
          const wps = Array.isArray(data?.waypoints) ? data.waypoints : [];
          const startWp = waypointToCoord(wps[0]);
          const endWp = waypointToCoord(wps[1]);
          setRouteDriverToPickupWaypoints([startWp, endWp].filter(Boolean));
        } else {
          setRouteDriverToPickup([]);
          setRouteDriverToPickupWaypoints([]);
        }
      } catch {
        if (pickupReqIdRef.current !== reqId) return;
        setRouteDriverToPickup([]);
        setRouteDriverToPickupWaypoints([]);
      }
    }, 600);

    return () => {
      if (pickupRouteDebounceRef.current) clearTimeout(pickupRouteDebounceRef.current);
    };
  }, [status, driverCoord?.latitude, driverCoord?.longitude, startCoord?.latitude, startCoord?.longitude]);

  useEffect(() => {
    if (!mapRef.current || !ride) return;
    const start = toValidCoord(ride.startLat, ride.startLng);
    const end = toValidCoord(ride.endLat, ride.endLng);
    const hasStartEnd = !!(start && end);
    const hasDriver = !!(driverLocation?.latitude && driverLocation?.longitude);

    // Once we have driver coords, ensure we fit at least once with the driver visible.
    if (hasDriver && !hasFittedWithDriverRef.current && start) {
      const points: any[] = [start];
      if (end) points.push(end);
      points.push(driverLocation);
      if (points.length >= 2) {
        mapRef.current.fitToCoordinates(points, {
          edgePadding: { top: 90, right: 90, bottom: 90, left: 90 },
          animated: true,
        });
        hasFittedWithDriverRef.current = true;
        hasAutoFittedRef.current = true;
      }
      return;
    }

    // Initial fit (start + end) so the route is visible quickly.
    if (hasAutoFittedRef.current) return;
    if (hasStartEnd) {
      mapRef.current.fitToCoordinates([start, end], {
        edgePadding: { top: 90, right: 90, bottom: 90, left: 90 },
        animated: true,
      });
      hasAutoFittedRef.current = true;
    }
  }, [ride, status, driverLocation]);

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
        {startCoord && (
          <Marker coordinate={startCoord} title="Pickup" pinColor="green" />
        )}
        {endCoord && (
          <Marker coordinate={endCoord} title="Destination" pinColor="red" />
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

        {/* Dotted snap connectors */}
        {startCoord && routeStartToEndWaypoints[0] && distanceMeters(startCoord, routeStartToEndWaypoints[0]) > 3 && (
          <Polyline
            coordinates={[startCoord, routeStartToEndWaypoints[0]]}
            strokeWidth={4}
            strokeColor="#9CA3AF"
            lineDashPattern={[1, 7]}
            lineCap="round"
            lineJoin="round"
            zIndex={20}
          />
        )}
        {endCoord && routeStartToEndWaypoints[1] && distanceMeters(endCoord, routeStartToEndWaypoints[1]) > 3 && (
          <Polyline
            coordinates={[routeStartToEndWaypoints[1], endCoord]}
            strokeWidth={4}
            strokeColor="#9CA3AF"
            lineDashPattern={[1, 7]}
            lineCap="round"
            lineJoin="round"
            zIndex={20}
          />
        )}
        {status === 'ACCEPTED' && driverCoord && routeDriverToPickupWaypoints[0] && distanceMeters(driverCoord, routeDriverToPickupWaypoints[0]) > 3 && (
          <Polyline
            coordinates={[driverCoord, routeDriverToPickupWaypoints[0]]}
            strokeWidth={4}
            strokeColor="#9CA3AF"
            lineDashPattern={[1, 7]}
            lineCap="round"
            lineJoin="round"
            zIndex={20}
          />
        )}
        {status === 'ACCEPTED' && startCoord && routeDriverToPickupWaypoints[1] && distanceMeters(startCoord, routeDriverToPickupWaypoints[1]) > 3 && (
          <Polyline
            coordinates={[routeDriverToPickupWaypoints[1], startCoord]}
            strokeWidth={4}
            strokeColor="#9CA3AF"
            lineDashPattern={[1, 7]}
            lineCap="round"
            lineJoin="round"
            zIndex={20}
          />
        )}

        {remainingStartToEnd.length > 1 && (
          <Polyline coordinates={remainingStartToEnd as any} strokeColor="#2563EB" strokeWidth={4} lineCap="round" lineJoin="round" />
        )}

        {status === 'ACCEPTED' && routeDriverToPickup.length > 1 && (
          <Polyline coordinates={routeDriverToPickup as any} strokeColor="#000000" strokeWidth={4} lineCap="round" lineJoin="round" />
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
