import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, Modal, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRide } from '../../context/RideContext';
import { initSocket } from '../../services/socket';
import api from '../../services/api';

const START_BASE_DISTANCE_M = 80;
const START_MAX_DISTANCE_M = 150;
const FINISH_BASE_DISTANCE_M = 120;
const FINISH_MAX_DISTANCE_M = 200;
const START_EARLY_WINDOW_MIN = 10;
type Coords = { latitude: number; longitude: number };

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

const toValidCoord = (lat: any, lng: any): Coords | null => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
};

const approxDist2 = (a: Coords, b: Coords) => {
  const dLat = a.latitude - b.latitude;
  const meanLatRad = ((a.latitude + b.latitude) / 2) * (Math.PI / 180);
  const dLon = (a.longitude - b.longitude) * Math.cos(meanLatRad);
  return dLat * dLat + dLon * dLon;
};

const findClosestIndex = (polyline: Coords[], point: Coords, startIndex = 0) => {
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

const geometryToPolyline = (geometry: any): Coords[] => {
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates)) return [];
  return coordinates
    .map((pair: any) => {
      const lng = Array.isArray(pair) ? pair[0] : null;
      const lat = Array.isArray(pair) ? pair[1] : null;
      const coord = toValidCoord(lat, lng);
      return coord;
    })
    .filter(Boolean) as Coords[];
};

const waypointToCoord = (waypoint: any): Coords | null => {
  const loc = waypoint?.location;
  if (!Array.isArray(loc) || loc.length < 2) return null;
  return toValidCoord(loc[1], loc[0]);
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const allowedMeters = (
  baseMeters: number,
  maxMeters: number,
  gpsAccuracyMeters?: number | null
) => {
  if (gpsAccuracyMeters == null || !Number.isFinite(gpsAccuracyMeters)) return baseMeters;
  // In real-world apps (Uber-like), the allowed radius grows a bit when GPS accuracy is poor,
  // but stays capped to avoid starting/ending too far away.
  return clamp(Math.round(baseMeters + gpsAccuracyMeters), baseMeters, maxMeters);
};

const parseScheduledStartMs = (dateDepart: any, heureDepart: any) => {
  if (!dateDepart || !heureDepart || typeof heureDepart !== 'string') return null;
  const parts = heureDepart.split(':');
  if (parts.length < 2) return null;
  const hh = Number.parseInt(parts[0], 10);
  const mm = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const d = new Date(dateDepart);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(hh, mm, 0, 0);
  return d.getTime();
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
  const [currentAccuracyM, setCurrentAccuracyM] = useState<number | null>(null);
  const [routeStartToEnd, setRouteStartToEnd] = useState<Coords[]>([]);
  const [routeDriverToPickup, setRouteDriverToPickup] = useState<Coords[]>([]);
  const [routeStartToEndWaypoints, setRouteStartToEndWaypoints] = useState<Coords[]>([]);
  const [routeDriverToPickupWaypoints, setRouteDriverToPickupWaypoints] = useState<Coords[]>([]);
  const [uiModal, setUiModal] = useState<{ visible: boolean; title: string; message: string; icon: any }>({
    visible: false,
    title: '',
    message: '',
    icon: 'information-outline',
  });

  const socketRef = useRef<any>(null);
  const mapRef = useRef<MapView | null>(null);
  const userInteractedWithMapRef = useRef(false);
  const autoFittedOnceRef = useRef(false);
  const lastPickupRouteFromRef = useRef<Coords | null>(null);
  const pickupRouteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startToEndReqIdRef = useRef(0);
  const pickupReqIdRef = useRef(0);

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

  const pickupCoord = toValidCoord(activeRide?.startLat, activeRide?.startLng);
  const destCoord = toValidCoord(activeRide?.endLat, activeRide?.endLng);
  const driverCoord = toValidCoord(currentLocation?.latitude, currentLocation?.longitude);
  const startToEndProgressIdxRef = useRef(0);

  const driverToPickupMeters =
    driverCoord && pickupCoord ? distanceMeters(driverCoord, pickupCoord) : null;
  const driverToDestMeters =
    driverCoord && destCoord ? distanceMeters(driverCoord, destCoord) : null;

  useEffect(() => {
    // Reset whenever the active ride changes or a new polyline is loaded.
    startToEndProgressIdxRef.current = 0;
  }, [activeRide?.id, activeRide?.status, routeStartToEnd.length]);

  const remainingStartToEnd = useMemo(() => {
    if (activeRide?.status !== 'IN_PROGRESS') return routeStartToEnd;
    if (!driverCoord || routeStartToEnd.length < 2) return routeStartToEnd;

    // Keep progress monotonic so the line doesn't re-appear behind the car due to GPS jitter.
    const closest = findClosestIndex(routeStartToEnd, driverCoord, startToEndProgressIdxRef.current);
    const nextIdx = Math.max(startToEndProgressIdxRef.current, closest);
    startToEndProgressIdxRef.current = nextIdx;

    const tail = routeStartToEnd.slice(nextIdx);
    if (tail.length < 2) return [driverCoord];
    return [driverCoord, ...tail];
  }, [
    activeRide?.status,
    driverCoord?.latitude,
    driverCoord?.longitude,
    routeStartToEnd,
  ]);

  const startAllowedM = allowedMeters(START_BASE_DISTANCE_M, START_MAX_DISTANCE_M, currentAccuracyM);
  const finishAllowedM = allowedMeters(FINISH_BASE_DISTANCE_M, FINISH_MAX_DISTANCE_M, currentAccuracyM);
  const scheduledStartMs = parseScheduledStartMs(activeRide?.dateDepart, activeRide?.heureDepart);
  const startAllowedFromMs = scheduledStartMs != null ? scheduledStartMs - START_EARLY_WINDOW_MIN * 60 * 1000 : null;
  const isTooEarlyToStart = startAllowedFromMs != null ? Date.now() < startAllowedFromMs : false;

  const canStart =
    activeRide?.status === 'ACCEPTED' &&
    driverToPickupMeters != null &&
    driverToPickupMeters <= startAllowedM &&
    !isTooEarlyToStart;
  const canFinish =
    activeRide?.status === 'IN_PROGRESS' &&
    driverToDestMeters != null &&
    driverToDestMeters <= finishAllowedM;

  const showMessage = (title: string, message: string, icon: any) => {
    setUiModal({ visible: true, title, message, icon });
  };

  // Fetch OSRM route for start -> end (follow roads instead of straight line).
  useEffect(() => {
    const start = toValidCoord(activeRide?.startLat, activeRide?.startLng);
    const end = toValidCoord(activeRide?.endLat, activeRide?.endLng);
    if (!start || !end) {
      setRouteStartToEnd([]);
      return;
    }

    startToEndReqIdRef.current += 1;
    const reqId = startToEndReqIdRef.current;

    (async () => {
      try {
        const { data } = await api.post('/ride/calculate', { start, end });
        if (startToEndReqIdRef.current !== reqId) return;
        if (data?.success && data?.geometry) {
          if (data?.provider) console.log('Route provider (start→end):', data.provider);
          setRouteStartToEnd(geometryToPolyline(data.geometry));
          const wps = Array.isArray(data?.waypoints) ? data.waypoints : [];
          const startWp = waypointToCoord(wps[0]);
          const endWp = waypointToCoord(wps[1]);
          setRouteStartToEndWaypoints([startWp, endWp].filter(Boolean) as Coords[]);
        } else {
          setRouteStartToEnd([]);
          setRouteStartToEndWaypoints([]);
        }
      } catch (err: any) {
        if (startToEndReqIdRef.current !== reqId) return;
        const backendMsg = err?.response?.data?.error || err?.response?.data?.message;
        console.warn('Route start->end fetch failed:', backendMsg || err?.message || err);
        setRouteStartToEnd([]);
        setRouteStartToEndWaypoints([]);
      }
    })();
  }, [activeRide?.startLat, activeRide?.startLng, activeRide?.endLat, activeRide?.endLng, activeRide?.id]);

  // Fetch OSRM route for driver -> pickup (debounced; avoids spamming on every GPS tick).
  useEffect(() => {
    if (activeRide?.status !== 'ACCEPTED') {
      setRouteDriverToPickup([]);
      setRouteDriverToPickupWaypoints([]);
      lastPickupRouteFromRef.current = null;
      return;
    }

    const driver = toValidCoord(currentLocation?.latitude, currentLocation?.longitude);
    const pickup = toValidCoord(activeRide?.startLat, activeRide?.startLng);
    if (!driver || !pickup) {
      setRouteDriverToPickup([]);
      lastPickupRouteFromRef.current = null;
      setRouteDriverToPickupWaypoints([]);
      return;
    }

    const last = lastPickupRouteFromRef.current;
    if (last && distanceMeters(last, driver) < 50) return;

    if (pickupRouteDebounceRef.current) clearTimeout(pickupRouteDebounceRef.current);
    pickupRouteDebounceRef.current = setTimeout(async () => {
      lastPickupRouteFromRef.current = driver;

      pickupReqIdRef.current += 1;
      const reqId = pickupReqIdRef.current;

      try {
        const { data } = await api.post('/ride/calculate', { start: driver, end: pickup });
        if (pickupReqIdRef.current !== reqId) return;
        if (data?.success && data?.geometry) {
          setRouteDriverToPickup(geometryToPolyline(data.geometry));
          const wps = Array.isArray(data?.waypoints) ? data.waypoints : [];
          const startWp = waypointToCoord(wps[0]);
          const endWp = waypointToCoord(wps[1]);
          setRouteDriverToPickupWaypoints([startWp, endWp].filter(Boolean) as Coords[]);
        } else {
          setRouteDriverToPickup([]);
          setRouteDriverToPickupWaypoints([]);
        }
      } catch (err: any) {
        if (pickupReqIdRef.current !== reqId) return;
        const backendMsg = err?.response?.data?.error || err?.response?.data?.message;
        console.warn('Route driver->pickup fetch failed:', backendMsg || err?.message || err);
        setRouteDriverToPickup([]);
        setRouteDriverToPickupWaypoints([]);
      }
    }, 600);

    return () => {
      if (pickupRouteDebounceRef.current) clearTimeout(pickupRouteDebounceRef.current);
    };
  }, [currentLocation?.latitude, currentLocation?.longitude, activeRide?.startLat, activeRide?.startLng, activeRide?.id]);

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
        setCurrentAccuracyM(
          Number.isFinite(firstLocation.coords.accuracy) ? firstLocation.coords.accuracy : null
        );

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
          setCurrentAccuracyM(
            Number.isFinite(loc.coords.accuracy) ? loc.coords.accuracy : null
          );

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

    if (!driverCoord) {
      showMessage('Localisation', 'Localisation indisponible.', 'location-outline');
      return;
    }

    if (!pickupCoord) {
      showMessage('Trajet', 'Point de prise en charge introuvable.', 'warning-outline');
      return;
    }

    if (!canStart) {
      if (isTooEarlyToStart) {
        const mins = startAllowedFromMs != null ? Math.ceil((startAllowedFromMs - Date.now()) / 60000) : null;
        showMessage(
          'Trop tôt',
          `Vous pouvez démarrer au plus tôt ${START_EARLY_WINDOW_MIN} minutes avant l'heure de départ.${mins != null ? ` (dans ${mins} min)` : ''}`,
          'time-outline'
        );
        return;
      }
      const meters = driverToPickupMeters != null ? Math.round(driverToPickupMeters) : null;
      showMessage(
        'Trop loin',
        `Rapprochez-vous du passager pour démarrer.${meters != null ? ` (${meters} m)` : ''}`,
        'warning-outline'
      );
      return;
    }

    try {
      const startedRide = await startRide(activeRide.id, {
        ...driverCoord,
        accuracy: currentAccuracyM,
      });
      setSelectedRide(startedRide);
      showMessage('Trajet démarré', 'Le trajet est maintenant en cours.', 'car-outline');
      getDriverActiveRide();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Impossible de demarrer le trajet';
      console.error('Start error', err);
      showMessage('Erreur', msg, 'close-circle-outline');
    }
  };

  const handleFinish = async () => {
    if (!activeRide) return;

    if (!driverCoord) {
      showMessage('Localisation', 'Localisation indisponible.', 'location-outline');
      return;
    }

    if (!destCoord) {
      showMessage('Trajet', 'Destination introuvable.', 'warning-outline');
      return;
    }

    if (!canFinish) {
      const meters = driverToDestMeters != null ? Math.round(driverToDestMeters) : null;
      showMessage(
        'Trop loin',
        `Rapprochez-vous de la destination pour terminer.${meters != null ? ` (${meters} m)` : ''}`,
        'warning-outline'
      );
      return;
    }

    try {
      const completedRide = await completeRide(activeRide.id, {
        ...driverCoord,
        accuracy: currentAccuracyM,
      });
      setSelectedRide(completedRide);
      showMessage('Trajet terminé', 'Merci, le trajet est terminé.', 'flag-outline');
      getDriverActiveRide();
      router.replace('/(driverTabs)/DriverHomeScreen' as any);
    } catch (err) {
      const anyErr: any = err;
      const msg = anyErr?.response?.data?.message || anyErr?.message || 'Impossible de terminer le trajet';
      console.error('Finish error', err);
      showMessage('Erreur', msg, 'close-circle-outline');
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

  const startToEndSnapStart = routeStartToEndWaypoints[0];
  const startToEndSnapEnd = routeStartToEndWaypoints[1];
  const driverToPickupSnapStart = routeDriverToPickupWaypoints[0];
  const driverToPickupSnapEnd = routeDriverToPickupWaypoints[1];

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
        {pickupCoord && (
          <Marker
            coordinate={{
              latitude: pickupCoord.latitude,
              longitude: pickupCoord.longitude,
            }}
            title="Passenger"
            pinColor="green"
          />
        )}

        {destCoord && (
          <Marker
            coordinate={{
              latitude: destCoord.latitude,
              longitude: destCoord.longitude,
            }}
            title="Destination"
            pinColor="red"
          />
        )}

        {driverCoord && (
          <Marker
            coordinate={driverCoord}
            title="Vous"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverIconWrap}>
              <MaterialCommunityIcons name="car" size={16} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Dotted "snap to road" connectors (like Google Maps) */}
        {pickupCoord && startToEndSnapStart && distanceMeters(pickupCoord, startToEndSnapStart) > 3 && (
          <Polyline
            coordinates={[pickupCoord, startToEndSnapStart]}
            strokeWidth={4}
            strokeColor="#9CA3AF"
            lineDashPattern={[1, 7]}
            lineCap="round"
            lineJoin="round"
            zIndex={20}
          />
        )}
        {destCoord && startToEndSnapEnd && distanceMeters(destCoord, startToEndSnapEnd) > 3 && (
          <Polyline
            coordinates={[startToEndSnapEnd, destCoord]}
            strokeWidth={4}
            strokeColor="#9CA3AF"
            lineDashPattern={[1, 7]}
            lineCap="round"
            lineJoin="round"
            zIndex={20}
          />
        )}
        {activeRide.status === 'ACCEPTED' &&
          driverCoord &&
          driverToPickupSnapStart &&
          distanceMeters(driverCoord, driverToPickupSnapStart) > 3 && (
          <Polyline
            coordinates={[driverCoord, driverToPickupSnapStart]}
            strokeWidth={4}
            strokeColor="#9CA3AF"
            lineDashPattern={[1, 7]}
            lineCap="round"
            lineJoin="round"
            zIndex={20}
          />
        )}
        {activeRide.status === 'ACCEPTED' &&
          pickupCoord &&
          driverToPickupSnapEnd &&
          distanceMeters(pickupCoord, driverToPickupSnapEnd) > 3 && (
          <Polyline
            coordinates={[driverToPickupSnapEnd, pickupCoord]}
            strokeWidth={4}
            strokeColor="#9CA3AF"
            lineDashPattern={[1, 7]}
            lineCap="round"
            lineJoin="round"
            zIndex={20}
          />
        )}

        {remainingStartToEnd.length > 1 && (
            <Polyline
              coordinates={remainingStartToEnd}
              strokeWidth={4}
              strokeColor="#2563EB"
              lineCap="round"
              lineJoin="round"
            />
          )}

        {activeRide.status === 'ACCEPTED' && routeDriverToPickup.length > 1 && (
            <Polyline
              coordinates={routeDriverToPickup}
              strokeWidth={4}
              strokeColor="#000000"
              lineCap="round"
              lineJoin="round"
            />
          )}
      </MapView>

      <View style={[styles.buttonContainer, { bottom: insets.bottom + 60 }]}>
        {activeRide.status === 'ACCEPTED' ? (
          <TouchableOpacity
            style={[styles.primaryBtn, !canStart && styles.primaryBtnDisabled]}
            onPress={handleStart}
            activeOpacity={0.9}
            disabled={!canStart}
          >
            <Text style={[styles.primaryBtnText, !canStart && styles.primaryBtnTextDisabled]}>
              DEMARRER
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, !canFinish && styles.primaryBtnDisabled]}
            onPress={handleFinish}
            activeOpacity={0.9}
            disabled={!canFinish}
          >
            <Text style={[styles.primaryBtnText, !canFinish && styles.primaryBtnTextDisabled]}>
              TERMINER
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={uiModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setUiModal((p) => ({ ...p, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <MaterialCommunityIcons name={uiModal.icon} size={28} color="#111827" />
            </View>
            <Text style={styles.modalTitle}>{uiModal.title}</Text>
            <Text style={styles.modalMessage}>{uiModal.message}</Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => setUiModal((p) => ({ ...p, visible: false }))}
              activeOpacity={0.9}
            >
              <Text style={styles.modalBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  primaryBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  primaryBtnTextDisabled: {
    color: '#9CA3AF',
  },
  driverIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalBtn: {
    marginTop: 6,
    alignSelf: 'stretch',
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
