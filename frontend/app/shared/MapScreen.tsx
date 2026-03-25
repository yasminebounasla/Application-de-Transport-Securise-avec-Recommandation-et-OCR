<<<<<<< HEAD
import React, { useContext, useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { LocationContext } from "../../context/LocationContext";
import { reverseGeocode } from "../../utils/reverseGeocode";
import { validateLocationsInAlgeria } from "../../utils/Geovalidation";
import { formatDuration, formatDistance } from "../../utils/formatUtils";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from "../../services/api";
import { calculatePrice } from "../../utils/priceCalculator";


function LocationNotSupported({ onTryAnother }) {
  return (
    <View style={errorStyles.overlay}>
      <View style={errorStyles.card}>
        <View style={errorStyles.iconContainer}>
          <View style={errorStyles.iconCircle}>
            <Ionicons name="location-outline" size={48} color="#000" />
          </View>
          <View style={errorStyles.iconBadge}>
            <Ionicons name="warning" size={18} color="#FFF" />
          </View>
        </View>
        <Text style={errorStyles.title}>Location is not supported</Text>
        <Text style={errorStyles.subtitle}>
          Sorry, our service is currently unavailable outside Algeria.{'\n'}
          Please try a different location.
        </Text>
        <TouchableOpacity
          style={errorStyles.button}
          onPress={onTryAnother}
          activeOpacity={0.85}
        >
          <Text style={errorStyles.buttonText}>Try another location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    selectionType,
    rideId,
    startAddress,
    endAddress,
    startLat,
    startLng,
    endLat,
    endLng,
    targetKey:   _targetKey,
    targetLabel: _targetLabel,
    fromOnboarding,   
  } = useLocalSearchParams();
  const targetKey   = (Array.isArray(_targetKey)   ? _targetKey[0]   : _targetKey)   as string;
  const targetLabel = (Array.isArray(_targetLabel)  ? _targetLabel[0] : _targetLabel) as string;

  const {
    currentLocation,
    startLocation,
    setStartLocation,
    endLocation,
    setEndLocation,
  } = useContext(LocationContext);

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedAddress, setSelectedAddress]   = useState("");
  const [loadingAddress, setLoadingAddress]     = useState(false);
  const [savingAddress, setSavingAddress]       = useState(false);

  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [loadingRoute, setLoadingRoute]         = useState(false);
  const [isValidRoute, setIsValidRoute]         = useState(true);
  const [routeDistance, setRouteDistance]       = useState<number | null>(null);
  const [routeDuration, setRouteDuration]       = useState<number | null>(null);
  const [estimatedPrice, setEstimatedPrice]     = useState<number | null>(null);
  const [showLocationError, setShowLocationError] = useState(false);
  const [showCancelModal, setShowCancelModal]   = useState(false);

  const mapRef          = useRef(null);
  const debounceTimeout = useRef(null);

  const goToCurrentLocation = () => {
    if (!currentLocation || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude:       currentLocation.latitude,
      longitude:      currentLocation.longitude,
      latitudeDelta:  0.01,
      longitudeDelta: 0.01,
    }, 500);
  };

  useEffect(() => {
    if (selectionType === "route" && startLocation && endLocation) {
      validateAndFetchRoute();
    } else if (selectionType === "route" && startLat && startLng && endLat && endLng) {
      const parseCoord = (coord) => {
        if (!coord) return null;
        const val = Array.isArray(coord) ? coord[0] : coord;
        return parseFloat(val);
      };
      const startLatNum = parseCoord(startLat);
      const startLngNum = parseCoord(startLng);
      const endLatNum   = parseCoord(endLat);
      const endLngNum   = parseCoord(endLng);
      if (startLatNum && startLngNum && endLatNum && endLngNum) {
        setStartLocation({ latitude: startLatNum, longitude: startLngNum });
        setEndLocation({ latitude: endLatNum, longitude: endLngNum });
      }
    }
  }, [selectionType, startLocation, endLocation, startLat, startLng, endLat, endLng]);

  useEffect(() => {
    if (selectionType === "route" && startLocation && endLocation && mapRef.current) {
      setTimeout(() => centerMapOnMarkers(), 500);
    }
  }, [selectionType, startLocation, endLocation]);

  const centerMapOnMarkers = () => {
    if (!mapRef.current || !startLocation || !endLocation) return;
    mapRef.current.fitToCoordinates(
      [
        { latitude: startLocation.latitude, longitude: startLocation.longitude },
        { latitude: endLocation.latitude,   longitude: endLocation.longitude },
      ],
      { edgePadding: { top: 200, right: 60, bottom: 280, left: 60 }, animated: true }
    );
  };

  const validateAndFetchRoute = async () => {
    const validation = await validateLocationsInAlgeria(startLocation, endLocation);
    if (!validation.valid) {
      setIsValidRoute(false);
      setRouteCoordinates([]);
      setRouteDistance(null);
      setRouteDuration(null);
      setEstimatedPrice(null);
      setShowLocationError(true);
      centerMapOnMarkers();
      return;
    }
    setIsValidRoute(true);
    setShowLocationError(false);
    fetchRoute();
  };

  const fetchRoute = async () => {
    setLoadingRoute(true);
    try {
      const response = await api.post('/ride/calculate', { start: startLocation, end: endLocation });
      const data = response.data;
      if (data.success && data.geometry?.coordinates) {
        const coords = data.geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
        setRouteCoordinates(coords);
        const distKm = parseFloat(data.distanceKm);
        const durMin = parseInt(data.durationMin, 10);
        setRouteDistance(distKm);
        setRouteDuration(durMin);
        const { price } = calculatePrice(distKm, durMin);
        setEstimatedPrice(price);
        if (rideId && rideId !== "" && rideId !== "undefined") {
          try {
            await api.patch(`/ridesDem/${rideId}/price`, { prix: price });
          } catch (e) {
            console.warn('⚠️ Price update skipped:', e.message);
          }
        }
        if (mapRef.current && coords.length > 0) {
          mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 200, right: 60, bottom: 280, left: 60 },
            animated: true,
          });
        }
      } else {
        centerMapOnMarkers();
      }
    } catch (error) {
      console.error('❌ Erreur route:', error);
      setIsValidRoute(false);
      centerMapOnMarkers();
    } finally {
      setLoadingRoute(false);
    }
  };

  const fetchAddress = async (coords) => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(async () => {
      setLoadingAddress(true);
      try {
        setSelectedAddress(await reverseGeocode(coords));
      } catch {
        setSelectedAddress("Error loading address");
      } finally {
        setLoadingAddress(false);
      }
    }, 500);
  };

  const handleMapPress = (e) => {
    if (selectionType === "route") return;
    const coords = e.nativeEvent.coordinate;
    setSelectedLocation(coords);
    fetchAddress(coords);
  };

  const handleMarkerDragEnd = (e) => {
    if (selectionType === "route") return;
    const coords = e.nativeEvent.coordinate;
    setSelectedLocation(coords);
    fetchAddress(coords);
  };

  const handleConfirm = () => {
    if (!selectedLocation) return;
    if (selectionType === "start") setStartLocation(selectedLocation);
    else setEndLocation(selectedLocation);
    router.back();
  };

  const handleConfirmSavedAddress = async () => {
    if (!selectedLocation || !selectedAddress) return;
    setSavingAddress(true);
    try {
      const label   = targetLabel || 'Saved place';
      const lat     = selectedLocation.latitude;
      const lng     = selectedLocation.longitude;
      const address = selectedAddress;
      const listRes = await api.get('/passengers/saved-places');
      const existing = (listRes.data.data || []).find(
        (p) => p.label.toLowerCase() === label.toLowerCase()
      );
      if (existing) {
        await api.put(`/passengers/saved-places/${existing.id}`, { label, address, lat, lng });
      } else {
        await api.post('/passengers/saved-places', { label, address, lat, lng });
      }
      router.back();
    } catch (e) {
      console.error("❌ Error saving address:", e);
      Alert.alert("Error", "Failed to save address. Please try again.");
    } finally {
      setSavingAddress(false);
    }
  };
   
  // ── ✅ FIXED: fromOnboarding → router.back() pour retourner au step 3 ─────
  const handleConfirmWorkZone = async () => {
    if (!selectedLocation) return;
    setSavingAddress(true);
    try {
      await api.patch('/drivers/profile/location', {
        latitude:  selectedLocation.latitude,
        longitude: selectedLocation.longitude, 
      });
      if (fromOnboarding === 'true') {
        router.back();                                      // ← retour → step 3 (Your Style)
      } else {
        router.replace('/(driverTabs)/DriverHomeScreen');   // ← flow normal
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to save location.');
      setSavingAddress(false);
    }
  };

  const handleCancelRide = () => {
    if (!rideId) {
      router.push("/passenger/SearchRideScreen");
      return;
    }
    setShowCancelModal(true);
  };

  const confirmCancelRide = async () => {
    setShowCancelModal(false);
    try {
      await api.put(`/ridesDem/${rideId}/cancel`);
    } catch (error) {
      console.error('❌ Erreur cancel:', error.response?.data || error.message);
    }
    router.replace("/(passengerTabs)/PassengerHomeScreen");
  };

  const handleTryAnother = () => {
    router.push("/passenger/SearchRideScreen");
  };

  const getInitialRegion = () => {
    if (selectionType === "route" && startLocation && endLocation) {
      return {
        latitude:       (startLocation.latitude  + endLocation.latitude)  / 2,
        longitude:      (startLocation.longitude + endLocation.longitude) / 2,
        latitudeDelta:  Math.abs(startLocation.latitude  - endLocation.latitude)  * 1.5 || 0.1,
        longitudeDelta: Math.abs(startLocation.longitude - endLocation.longitude) * 1.5 || 0.1,
      };
    }
    return {
      latitude:       currentLocation?.latitude  ?? 36.7538,
      longitude:      currentLocation?.longitude ?? 3.0588,
      latitudeDelta:  0.01,
      longitudeDelta: 0.01,
    };
  };

  if (!currentLocation) return null;

  // ── MODE: saved_address ──────────────────────
  if (selectionType === "saved_address") {
    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={getInitialRegion()}
          showsUserLocation
          showsMyLocationButton={false}
          onPress={handleMapPress}
        >
          {selectedLocation?.latitude && selectedLocation?.longitude && (
            <Marker coordinate={selectedLocation} draggable onDragEnd={handleMarkerDragEnd} />
          )}
        </MapView>

        <TouchableOpacity style={[styles.locationButton, { bottom: 220 }]}  onPress={goToCurrentLocation} activeOpacity={0.8}>
          <Ionicons name="locate" size={20} color="#007AFF" />
        </TouchableOpacity>

        <View style={styles.bottomSheetFixed}>
          <View style={styles.dragHandle} />
          <Text style={styles.title}>
            {targetLabel ? `Set ${targetLabel} location` : 'Set location'}
          </Text>
          {loadingAddress ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#666" />
              <Text style={styles.loadingText}>Loading address...</Text>
            </View>
          ) : (
            <Text style={styles.address} numberOfLines={2}>
              {selectedAddress || 'Tap or drag pin on map'}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.confirmBtn, (!selectedLocation || loadingAddress || savingAddress) && styles.confirmBtnDisabled]}
            onPress={handleConfirmSavedAddress}
            disabled={!selectedLocation || loadingAddress || savingAddress}
            activeOpacity={0.8}
          >
            {savingAddress
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.confirmText}>Save address</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    );
  }

 // ── MODE: work_zone ──────────────────────────
 if (selectionType === "work_zone") {
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={getInitialRegion()}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={async (region) => {
          const coords = { latitude: region.latitude, longitude: region.longitude };
          setSelectedLocation(coords);
          fetchAddress(coords);
        }}
      >
        {/* pas de Marker — pin fixe au centre */}
      </MapView>

      {/* Pin fixe au centre */}
      <View pointerEvents="none" style={wzStyles.pinWrap}>
        <Ionicons name="location" size={40} color="#294190" />
        <View style={wzStyles.pinShadow} />
      </View>

      {/* Address pill flottante au dessus du pin */}
      <View style={wzStyles.floatingPill}>
        <Text style={wzStyles.floatingHint}>MOVE THE MAP TO SPECIFY YOUR LOCATION</Text>
        {loadingAddress ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={wzStyles.floatingAddress}>Loading...</Text>
          </View>
        ) : (
          <Text style={wzStyles.floatingAddress} numberOfLines={1}>
            {selectedAddress || 'Move the map...'}
          </Text>
        )}
      </View>

      {/* Locate button */}
      <TouchableOpacity style={styles.locationButton} onPress={goToCurrentLocation} activeOpacity={0.8}>
        <Ionicons name="locate" size={20} color="#007AFF" />
      </TouchableOpacity>

      {/* Bottom CTA */}
      <View style={wzStyles.bottomBar}>
        <TouchableOpacity
          style={[wzStyles.cta, (!selectedLocation || loadingAddress || savingAddress) && wzStyles.ctaDisabled]}
          onPress={handleConfirmWorkZone}
          disabled={!selectedLocation || loadingAddress || savingAddress}
          activeOpacity={0.85}
        >
          {savingAddress ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={wzStyles.ctaText}>Confirm</Text>
          )}
        </TouchableOpacity>
      </View>

    </View>
  );
 }
 
  // ── MODE: route ──────────────────────────────
  if (selectionType === "route") {
    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={getInitialRegion()}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {startLocation?.latitude && startLocation?.longitude && (
            <Marker coordinate={startLocation} pinColor="green" />
          )}
          {endLocation?.latitude && endLocation?.longitude && (
            <Marker coordinate={endLocation} pinColor="red" />
          )}
          {isValidRoute && routeCoordinates.length > 0 && (
            <Polyline coordinates={routeCoordinates} strokeColor="#294190" strokeWidth={2} />
          )}
        </MapView>

        <View style={routeStyles.topCard}>
          <View style={routeStyles.addressRow}>
            <View style={routeStyles.dotGreen} />
            <Text style={routeStyles.addressText} numberOfLines={1}>{startAddress || "Departure"}</Text>
          </View>
          <View style={routeStyles.addressDivider} />
          <View style={routeStyles.addressRow}>
            <View style={routeStyles.dotRed} />
            <Text style={routeStyles.addressText} numberOfLines={1}>{endAddress || "Destination"}</Text>
          </View>
        </View>

        {showLocationError ? (
          <LocationNotSupported onTryAnother={handleTryAnother} />
        ) : (
          <View
            style={[
              routeStyles.bottomSheet,
              {
                paddingBottom:
                  Math.max(insets.bottom, Platform.OS === 'ios' ? 28 : 24) +
                  (Platform.OS === 'android' ? 32 : 16),
              },
            ]}
          >
            <View style={routeStyles.handle} />
            {loadingRoute ? (
              <View style={routeStyles.loadingRow}>
                <ActivityIndicator size="small" color="#111" />
                <Text style={routeStyles.loadingText}>Calculating route...</Text>
              </View>
            ) : (
              <>
                {estimatedPrice !== null && (
                  <View style={routeStyles.priceRow}>
                    <View>
                      <Text style={routeStyles.priceLabel}>Estimated price</Text>
                      <Text style={routeStyles.priceValue}>
                        {estimatedPrice.toLocaleString()} <Text style={routeStyles.priceCurrency}>DA</Text>
                      </Text>
                    </View>
                    {routeDistance !== null && routeDuration !== null && (
                      <View style={routeStyles.metaBox}>
                        <View style={routeStyles.metaItem}>
                          <Ionicons name="navigate-outline" size={13} color="#666" />
                          <Text style={routeStyles.metaText}>{formatDistance(routeDistance)}</Text>
                        </View>
                        <View style={routeStyles.metaDot} />
                        <View style={routeStyles.metaItem}>
                          <Ionicons name="time-outline" size={13} color="#666" />
                          <Text style={routeStyles.metaText}>{formatDuration(routeDuration)}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={routeStyles.ctaButton}
                  onPress={() => router.push({
                    pathname: "/passenger/RecommendedDriversScreen",
                    params: { rideId, startAddress, endAddress },
                  })}
                  activeOpacity={0.85}
                >
                  <View style={routeStyles.ctaInner}>
                    <View>
                      <Text style={routeStyles.ctaLabel}>Ready to go?</Text>
                      <Text style={routeStyles.ctaText}>Find Drivers</Text>
                    </View>
                    <View style={routeStyles.ctaArrow}>
                      <Ionicons name="arrow-forward" size={20} color="#111" />
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={routeStyles.cancelButton} onPress={handleCancelRide} activeOpacity={0.7}>
                  <Text style={routeStyles.cancelText}>Cancel ride</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <Modal
          visible={showCancelModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCancelModal(false)}
        >
          <View style={cancelStyles.overlay}>
            <View style={cancelStyles.card}>
              <View style={cancelStyles.iconWrap}>
                <Ionicons name="close-circle-outline" size={40} color="#EF4444" />
              </View>
              <Text style={cancelStyles.title}>Cancel this ride?</Text>
              <Text style={cancelStyles.subtitle}>
                Your ride request will be removed and drivers will no longer see it.
              </Text>
              <TouchableOpacity style={cancelStyles.confirmBtn} onPress={confirmCancelRide} activeOpacity={0.85}>
                <Text style={cancelStyles.confirmText}>Yes, cancel ride</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cancelStyles.keepBtn} onPress={() => setShowCancelModal(false)} activeOpacity={0.7}>
                <Text style={cancelStyles.keepText}>Keep ride</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── MODE: start / destination ────────────────
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={getInitialRegion()}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={handleMapPress}
      >
        {selectedLocation?.latitude && selectedLocation?.longitude && (
          <Marker coordinate={selectedLocation} draggable onDragEnd={handleMarkerDragEnd} />
        )}
      </MapView>

      <TouchableOpacity style={styles.locationButton} onPress={goToCurrentLocation} activeOpacity={0.8}>
        <Ionicons name="locate" size={20} color="#007AFF" />
      </TouchableOpacity>

      <View style={styles.bottomSheetFixed}>
        <View style={styles.dragHandle} />
        <Text style={styles.title}>
          {selectionType === "start" ? "Set pickup location" : "Set destination"}
        </Text>
        {loadingAddress ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#666" />
            <Text style={styles.loadingText}>Loading address...</Text>
          </View>
        ) : (
          <Text style={styles.address}>{selectedAddress || "Tap on map"}</Text>
        )}
        <TouchableOpacity
          style={[styles.confirmBtn, (!selectedLocation || loadingAddress) && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!selectedLocation || loadingAddress}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  card: {
    alignItems: "center",
  },
  iconContainer: {
    position: "relative",
    marginBottom: 20,
    marginTop: 8,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  iconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  button: {
    backgroundColor: "#000",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 50,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

const styles = StyleSheet.create({
  // Top label for saved_address mode
  topLabelContainer: {
    position: "absolute", top: 50, left: 20, right: 20, zIndex: 10,
  },
  topLabelCard: {
    backgroundColor: "#FFF",
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
  },
  topLabelText: { fontSize: 14, color: "#444", flex: 1 },
  container: { flex: 1, backgroundColor: "#FFF" },
  map: { flex: 1 },
  topAddresses: {
    position: "absolute",
    top: 10,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  addressCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  addressSeparator: { height: 10 },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
  },
  dotRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#DC2626",
  },
  addressText: {
    fontSize: 15,
    color: "#202124",
    flex: 1,
    fontWeight: "500",
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#DADCE0",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 12,
  },
  loadingText: {
    fontSize: 15,
    color: "#666",
    fontStyle: "italic",
  },
  recommendedSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F9FA",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  recommendedContent: { flex: 1 },
  recommendedTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  distanceText: {
    fontSize: 14,
    color: "#5F6368",
  },
  cancelRideButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FEE2E2",
  },
  cancelRideText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#E53E3E",
  },
  bottomSheetFixed: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: "#FFF",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
  },
  address: {
    fontSize: 15,
    color: "#666",
    marginBottom: 16,
  },
  confirmBtn: {
    backgroundColor: "#000",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmBtnDisabled: {
    backgroundColor: "#CCC",
    opacity: 0.6,
  },
  confirmText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
  },
  // ── Route info row: distance·durée  +  prix ──
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  routeMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  routeMetaText: {
    fontSize: 13, color: '#666', fontWeight: '500',
  },
  priceChip: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 10, color: '#999', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  priceValue: {
    fontSize: 20, fontWeight: '800', color: '#111',
  },
  locationButton: {
  position: 'absolute',
  right: 16,
  bottom: 110,
  width: 44, height: 44, borderRadius: 22,
  backgroundColor: '#fff',
  justifyContent: 'center', alignItems: 'center',
  shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12, shadowRadius: 8,
  elevation: 30, zIndex: 999,
},
});
// ── Route mode styles ─────────────────────────────────────────────────────────
const routeStyles = StyleSheet.create({
  topCard: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  addressDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 22,
  },
  dotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
  },
  dotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },

  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  priceLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.5,
  },
  priceCurrency: {
    fontSize: 20,
    fontWeight: '700',
    color: '#555',
  },
  metaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CCC',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },

  ctaButton: {
  backgroundColor: '#111',
  borderRadius: 20,
  paddingVertical: 18,
  paddingHorizontal: 20,
  marginBottom: 10,
},
ctaInner: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
ctaLabel: {
  fontSize: 11,
  fontWeight: '500',
  color: '#888',
  marginBottom: 2,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
},
ctaText: {
  fontSize: 20,
  fontWeight: '800',
  color: '#fff',
  letterSpacing: -0.3,
},
ctaArrow: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#fff',
  alignItems: 'center',
  justifyContent: 'center',
},
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});
const cancelStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmBtn: {
    width: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  keepBtn: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  keepText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
});

// ── wzStyles — add these to your StyleSheet ──────────────────────────────────
const wzStyles = StyleSheet.create({
  // Pin fixe au centre
  pinWrap: {
    position:        'absolute',
    top:             '50%',
    left:            '50%',
    marginLeft:      -20,
    marginTop:       -40,
    alignItems:      'center',
  },
  pinShadow: {
    width:           10,
    height:          4,
    borderRadius:    5,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginTop:       -2,
  },

  // Floating pill
  floatingPill: {
    position:          'absolute',
    top:               '50%',
    left:              24,
    right:             24,
    marginTop:         10,
    backgroundColor:   '#1a1a2e',
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical:   8, 
    alignItems:        'center',
    shadowColor:       '#000000',
    shadowOpacity:     0.25,
    shadowRadius:      12,
    shadowOffset:      { width: 0, height: 4 },
    elevation:         8,
  },
  floatingHint: {
    fontSize:      10,
    color:         'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    fontWeight:    '600',
    marginBottom:  4,
  },
  floatingAddress: {
    fontSize:   14,
    color:      '#fff',
    fontWeight: '600',
    textAlign:  'center',
  },

  // Bottom bar
  bottomBar: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 24,
    paddingBottom:     40,
    paddingTop:        16,
    backgroundColor:   'transparent',
  },
  cta: {
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#0a3980',
    borderRadius:    50,  
    paddingVertical: 14,        
    paddingHorizontal: 170,     
    alignSelf:       'center',  
  },
  ctaDisabled: {
    backgroundColor: 'rgba(41,65,144,0.4)',
  },
  ctaText: {
    color:         '#fff',
    fontSize:      16,
    fontWeight:    '700',
    letterSpacing: -0.2,
  },
  errorOverlay: {
  flex:              1,
  backgroundColor:   'rgba(0,0,0,0.45)',
  alignItems:        'center',
  justifyContent:    'center',
  paddingHorizontal: 32,
},
errorCard: {
  backgroundColor:   '#fff',
  borderRadius:      24,
  paddingHorizontal: 24,
  paddingVertical:   28,
  alignItems:        'center',
  width:             '100%',
  shadowColor:       '#000',
  shadowOpacity:     0.12,
  shadowRadius:      20,
  elevation:         10,
},
errorIconCircle: {
  width:           56,
  height:          56,
  borderRadius:    28,
  backgroundColor: '#FEE2E2',
  alignItems:      'center',
  justifyContent:  'center',
  marginBottom:    16,
},
errorTitle: {
  fontSize:      18,
  fontWeight:    '800',
  color:         '#111',
  marginBottom:  8,
  letterSpacing: -0.3,
},
errorMsg: {
  fontSize:     12,      // ← réduit
  color:        '#888',
  textAlign:    'center',
  lineHeight:   18,      // ← réduit
  marginBottom: 20,      // ← réduit
},
errorBtn: {
  backgroundColor:   '#FEE2E2',
  borderRadius:      14,
  paddingVertical:   14,    // ← plus tall
  paddingHorizontal: 70,    // ← plus large
  width:             '100%', // ← full width
  alignItems:        'center',
},
errorBtnText: {
  color:      '#EF4444',
  fontSize:   16,        // ← plus grand
  fontWeight: '700',
},
});
=======
import React, { useContext, useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { LocationContext } from "../../context/LocationContext";
import { reverseGeocode } from "../../utils/reverseGeocode";
import { validateLocationsInAlgeria } from "../../utils/Geovalidation";
import { formatDuration, formatDistance } from "../../utils/formatUtils";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import api from "../../services/api";
import { calculatePrice } from "../../utils/priceCalculator";


function LocationNotSupported({ onTryAnother }) {
  return (
    <View style={errorStyles.overlay}>
      <View style={errorStyles.card}>
        <View style={errorStyles.iconContainer}>
          <View style={errorStyles.iconCircle}>
            <Ionicons name="location-outline" size={48} color="#000" />
          </View>
          <View style={errorStyles.iconBadge}>
            <Ionicons name="warning" size={18} color="#FFF" />
          </View>
        </View>
        <Text style={errorStyles.title}>Location is not supported</Text>
        <Text style={errorStyles.subtitle}>
          Sorry, our service is currently unavailable outside Algeria.{'\n'}
          Please try a different location.
        </Text>
        <TouchableOpacity
          style={errorStyles.button}
          onPress={onTryAnother}
          activeOpacity={0.85}
        >
          <Text style={errorStyles.buttonText}>Try another location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const {
    selectionType,
    rideId,
    startAddress,
    endAddress,
    startLat,
    startLng,
    endLat,
    endLng,
    targetKey:   _targetKey,
    targetLabel: _targetLabel,
    fromOnboarding,   
  } = useLocalSearchParams();
  const targetKey   = (Array.isArray(_targetKey)   ? _targetKey[0]   : _targetKey)   as string;
  const targetLabel = (Array.isArray(_targetLabel)  ? _targetLabel[0] : _targetLabel) as string;

  const {
    currentLocation,
    startLocation,
    setStartLocation,
    endLocation,
    setEndLocation,
  } = useContext(LocationContext);

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedAddress, setSelectedAddress]   = useState("");
  const [loadingAddress, setLoadingAddress]     = useState(false);
  const [savingAddress, setSavingAddress]       = useState(false);

  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [loadingRoute, setLoadingRoute]         = useState(false);
  const [isValidRoute, setIsValidRoute]         = useState(true);
  const [routeDistance, setRouteDistance]       = useState<number | null>(null);
  const [routeDuration, setRouteDuration]       = useState<number | null>(null);
  const [estimatedPrice, setEstimatedPrice]     = useState<number | null>(null);
  const [showLocationError, setShowLocationError] = useState(false);
  const [showCancelModal, setShowCancelModal]   = useState(false);

  const mapRef          = useRef(null);
  const debounceTimeout = useRef(null);

  const goToCurrentLocation = () => {
    if (!currentLocation || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude:       currentLocation.latitude,
      longitude:      currentLocation.longitude,
      latitudeDelta:  0.01,
      longitudeDelta: 0.01,
    }, 500);
  };

  useEffect(() => {
    if (selectionType === "route" && startLocation && endLocation) {
      validateAndFetchRoute();
    } else if (selectionType === "route" && startLat && startLng && endLat && endLng) {
      const parseCoord = (coord) => {
        if (!coord) return null;
        const val = Array.isArray(coord) ? coord[0] : coord;
        return parseFloat(val);
      };
      const startLatNum = parseCoord(startLat);
      const startLngNum = parseCoord(startLng);
      const endLatNum   = parseCoord(endLat);
      const endLngNum   = parseCoord(endLng);
      if (startLatNum && startLngNum && endLatNum && endLngNum) {
        setStartLocation({ latitude: startLatNum, longitude: startLngNum });
        setEndLocation({ latitude: endLatNum, longitude: endLngNum });
      }
    }
  }, [selectionType, startLocation, endLocation, startLat, startLng, endLat, endLng]);

  useEffect(() => {
    if (selectionType === "route" && startLocation && endLocation && mapRef.current) {
      setTimeout(() => centerMapOnMarkers(), 500);
    }
  }, [selectionType, startLocation, endLocation]);

  const centerMapOnMarkers = () => {
    if (!mapRef.current || !startLocation || !endLocation) return;
    mapRef.current.fitToCoordinates(
      [
        { latitude: startLocation.latitude, longitude: startLocation.longitude },
        { latitude: endLocation.latitude,   longitude: endLocation.longitude },
      ],
      { edgePadding: { top: 200, right: 60, bottom: 280, left: 60 }, animated: true }
    );
  };

  const validateAndFetchRoute = async () => {
    const validation = await validateLocationsInAlgeria(startLocation, endLocation);
    if (!validation.valid) {
      setIsValidRoute(false);
      setRouteCoordinates([]);
      setRouteDistance(null);
      setRouteDuration(null);
      setEstimatedPrice(null);
      setShowLocationError(true);
      centerMapOnMarkers();
      return;
    }
    setIsValidRoute(true);
    setShowLocationError(false);
    fetchRoute();
  };

  const fetchRoute = async () => {
    setLoadingRoute(true);
    try {
      const response = await api.post('/ride/calculate', { start: startLocation, end: endLocation });
      const data = response.data;
      if (data.success && data.geometry?.coordinates) {
        const coords = data.geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
        setRouteCoordinates(coords);
        const distKm = parseFloat(data.distanceKm);
        const durMin = parseInt(data.durationMin, 10);
        setRouteDistance(distKm);
        setRouteDuration(durMin);
        const { price } = calculatePrice(distKm, durMin);
        setEstimatedPrice(price);
        if (rideId && rideId !== "" && rideId !== "undefined") {
          try {
            await api.patch(`/ridesDem/${rideId}/price`, { prix: price });
          } catch (e) {
            console.warn('⚠️ Price update skipped:', e.message);
          }
        }
        if (mapRef.current && coords.length > 0) {
          mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 200, right: 60, bottom: 280, left: 60 },
            animated: true,
          });
        }
      } else {
        centerMapOnMarkers();
      }
    } catch (error) {
      console.error('❌ Erreur route:', error);
      setIsValidRoute(false);
      centerMapOnMarkers();
    } finally {
      setLoadingRoute(false);
    }
  };

  const fetchAddress = async (coords) => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(async () => {
      setLoadingAddress(true);
      try {
        setSelectedAddress(await reverseGeocode(coords));
      } catch {
        setSelectedAddress("Error loading address");
      } finally {
        setLoadingAddress(false);
      }
    }, 500);
  };

  const handleMapPress = (e) => {
    if (selectionType === "route") return;
    const coords = e.nativeEvent.coordinate;
    setSelectedLocation(coords);
    fetchAddress(coords);
  };

  const handleMarkerDragEnd = (e) => {
    if (selectionType === "route") return;
    const coords = e.nativeEvent.coordinate;
    setSelectedLocation(coords);
    fetchAddress(coords);
  };

  const handleConfirm = () => {
    if (!selectedLocation) return;
    if (selectionType === "start") setStartLocation(selectedLocation);
    else setEndLocation(selectedLocation);
    router.back();
  };

  const handleConfirmSavedAddress = async () => {
    if (!selectedLocation || !selectedAddress) return;
    setSavingAddress(true);
    try {
      const label   = targetLabel || 'Saved place';
      const lat     = selectedLocation.latitude;
      const lng     = selectedLocation.longitude;
      const address = selectedAddress;
      const listRes = await api.get('/passengers/saved-places');
      const existing = (listRes.data.data || []).find(
        (p) => p.label.toLowerCase() === label.toLowerCase()
      );
      if (existing) {
        await api.put(`/passengers/saved-places/${existing.id}`, { label, address, lat, lng });
      } else {
        await api.post('/passengers/saved-places', { label, address, lat, lng });
      }
      router.back();
    } catch (e) {
      console.error("❌ Error saving address:", e);
      Alert.alert("Error", "Failed to save address. Please try again.");
    } finally {
      setSavingAddress(false);
    }
  };
   
  // ── ✅ FIXED: fromOnboarding → router.back() pour retourner au step 3 ─────
  const handleConfirmWorkZone = async () => {
    if (!selectedLocation) return;
    setSavingAddress(true);
    try {
      await api.patch('/drivers/profile/location', {
        latitude:  selectedLocation.latitude,
        longitude: selectedLocation.longitude, 
      });
      if (fromOnboarding === 'true') {
        router.back();                                      // ← retour → step 3 (Your Style)
      } else {
        router.replace('/(driverTabs)/DriverHomeScreen');   // ← flow normal
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to save location.');
      setSavingAddress(false);
    }
  };

  const handleCancelRide = () => {
    if (!rideId) {
      router.push("/passenger/SearchRideScreen");
      return;
    }
    setShowCancelModal(true);
  };

  const confirmCancelRide = async () => {
    setShowCancelModal(false);
    try {
      await api.put(`/ridesDem/${rideId}/cancel`);
    } catch (error) {
      console.error('❌ Erreur cancel:', error.response?.data || error.message);
    }
    router.replace("/(passengerTabs)/PassengerHomeScreen");
  };

  const handleTryAnother = () => {
    router.push("/passenger/SearchRideScreen");
  };

  const getInitialRegion = () => {
    if (selectionType === "route" && startLocation && endLocation) {
      return {
        latitude:       (startLocation.latitude  + endLocation.latitude)  / 2,
        longitude:      (startLocation.longitude + endLocation.longitude) / 2,
        latitudeDelta:  Math.abs(startLocation.latitude  - endLocation.latitude)  * 1.5 || 0.1,
        longitudeDelta: Math.abs(startLocation.longitude - endLocation.longitude) * 1.5 || 0.1,
      };
    }
    return {
      latitude:       currentLocation?.latitude  ?? 36.7538,
      longitude:      currentLocation?.longitude ?? 3.0588,
      latitudeDelta:  0.01,
      longitudeDelta: 0.01,
    };
  };

  if (!currentLocation) return null;

  // ── MODE: saved_address ──────────────────────
  if (selectionType === "saved_address") {
    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={getInitialRegion()}
          showsUserLocation
          showsMyLocationButton={false}
          onPress={handleMapPress}
        >
          {selectedLocation?.latitude && selectedLocation?.longitude && (
            <Marker coordinate={selectedLocation} draggable onDragEnd={handleMarkerDragEnd} />
          )}
        </MapView>

        <TouchableOpacity style={[styles.locationButton, { bottom: 220 }]}  onPress={goToCurrentLocation} activeOpacity={0.8}>
          <Ionicons name="locate" size={20} color="#007AFF" />
        </TouchableOpacity>

        <View style={styles.bottomSheetFixed}>
          <View style={styles.dragHandle} />
          <Text style={styles.title}>
            {targetLabel ? `Set ${targetLabel} location` : 'Set location'}
          </Text>
          {loadingAddress ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#666" />
              <Text style={styles.loadingText}>Loading address...</Text>
            </View>
          ) : (
            <Text style={styles.address} numberOfLines={2}>
              {selectedAddress || 'Tap or drag pin on map'}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.confirmBtn, (!selectedLocation || loadingAddress || savingAddress) && styles.confirmBtnDisabled]}
            onPress={handleConfirmSavedAddress}
            disabled={!selectedLocation || loadingAddress || savingAddress}
            activeOpacity={0.8}
          >
            {savingAddress
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.confirmText}>Save address</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    );
  }

 // ── MODE: work_zone ──────────────────────────
 if (selectionType === "work_zone") {
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={getInitialRegion()}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={async (region) => {
          const coords = { latitude: region.latitude, longitude: region.longitude };
          setSelectedLocation(coords);
          fetchAddress(coords);
        }}
      >
        {/* pas de Marker — pin fixe au centre */}
      </MapView>

      {/* Pin fixe au centre */}
      <View pointerEvents="none" style={wzStyles.pinWrap}>
        <Ionicons name="location" size={40} color="#294190" />
        <View style={wzStyles.pinShadow} />
      </View>

      {/* Address pill flottante au dessus du pin */}
      <View style={wzStyles.floatingPill}>
        <Text style={wzStyles.floatingHint}>MOVE THE MAP TO SPECIFY YOUR LOCATION</Text>
        {loadingAddress ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={wzStyles.floatingAddress}>Loading...</Text>
          </View>
        ) : (
          <Text style={wzStyles.floatingAddress} numberOfLines={1}>
            {selectedAddress || 'Move the map...'}
          </Text>
        )}
      </View>

      {/* Locate button */}
      <TouchableOpacity style={styles.locationButton} onPress={goToCurrentLocation} activeOpacity={0.8}>
        <Ionicons name="locate" size={20} color="#007AFF" />
      </TouchableOpacity>

      {/* Bottom CTA */}
      <View style={wzStyles.bottomBar}>
        <TouchableOpacity
          style={[wzStyles.cta, (!selectedLocation || loadingAddress || savingAddress) && wzStyles.ctaDisabled]}
          onPress={handleConfirmWorkZone}
          disabled={!selectedLocation || loadingAddress || savingAddress}
          activeOpacity={0.85}
        >
          {savingAddress ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={wzStyles.ctaText}>Confirm</Text>
          )}
        </TouchableOpacity>
      </View>

    </View>
  );
 }
 
  // ── MODE: route ──────────────────────────────
  if (selectionType === "route") {
    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={getInitialRegion()}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {startLocation?.latitude && startLocation?.longitude && (
            <Marker coordinate={startLocation} pinColor="green" />
          )}
          {endLocation?.latitude && endLocation?.longitude && (
            <Marker coordinate={endLocation} pinColor="blue" />
          )}
          {isValidRoute && routeCoordinates.length > 0 && (
            <Polyline coordinates={routeCoordinates} strokeColor="#294190" strokeWidth={2} />
          )}
        </MapView>

        <View style={routeStyles.topCard}>
          <View style={routeStyles.addressRow}>
            <View style={routeStyles.dotGreen} />
            <Text style={routeStyles.addressText} numberOfLines={1}>{startAddress || "Departure"}</Text>
          </View>
          <View style={routeStyles.addressDivider} />
          <View style={routeStyles.addressRow}>
            <View style={routeStyles.dotBlue} />
            <Text style={routeStyles.addressText} numberOfLines={1}>{endAddress || "Destination"}</Text>
          </View>
        </View>

        {showLocationError ? (
          <LocationNotSupported onTryAnother={handleTryAnother} />
        ) : (
          <View style={routeStyles.bottomSheet}>
            <View style={routeStyles.handle} />
            {loadingRoute ? (
              <View style={routeStyles.loadingRow}>
                <ActivityIndicator size="small" color="#111" />
                <Text style={routeStyles.loadingText}>Calculating route...</Text>
              </View>
            ) : (
              <>
                {estimatedPrice !== null && (
                  <View style={routeStyles.priceRow}>
                    <View>
                      <Text style={routeStyles.priceLabel}>Estimated price</Text>
                      <Text style={routeStyles.priceValue}>
                        {estimatedPrice.toLocaleString()} <Text style={routeStyles.priceCurrency}>DA</Text>
                      </Text>
                    </View>
                    {routeDistance !== null && routeDuration !== null && (
                      <View style={routeStyles.metaBox}>
                        <View style={routeStyles.metaItem}>
                          <Ionicons name="navigate-outline" size={13} color="#666" />
                          <Text style={routeStyles.metaText}>{formatDistance(routeDistance)}</Text>
                        </View>
                        <View style={routeStyles.metaDot} />
                        <View style={routeStyles.metaItem}>
                          <Ionicons name="time-outline" size={13} color="#666" />
                          <Text style={routeStyles.metaText}>{formatDuration(routeDuration)}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={routeStyles.ctaButton}
                  onPress={() => router.push({
                    pathname: "/passenger/RecommendedDriversScreen",
                    params: { rideId, startAddress, endAddress },
                  })}
                  activeOpacity={0.85}
                >
                  <View style={routeStyles.ctaInner}>
                    <View>
                      <Text style={routeStyles.ctaLabel}>Ready to go?</Text>
                      <Text style={routeStyles.ctaText}>Find Drivers</Text>
                    </View>
                    <View style={routeStyles.ctaArrow}>
                      <Ionicons name="arrow-forward" size={20} color="#111" />
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={routeStyles.cancelButton} onPress={handleCancelRide} activeOpacity={0.7}>
                  <Text style={routeStyles.cancelText}>Cancel ride</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <Modal
          visible={showCancelModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCancelModal(false)}
        >
          <View style={cancelStyles.overlay}>
            <View style={cancelStyles.card}>
              <View style={cancelStyles.iconWrap}>
                <Ionicons name="close-circle-outline" size={40} color="#EF4444" />
              </View>
              <Text style={cancelStyles.title}>Cancel this ride?</Text>
              <Text style={cancelStyles.subtitle}>
                Your ride request will be removed and drivers will no longer see it.
              </Text>
              <TouchableOpacity style={cancelStyles.confirmBtn} onPress={confirmCancelRide} activeOpacity={0.85}>
                <Text style={cancelStyles.confirmText}>Yes, cancel ride</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cancelStyles.keepBtn} onPress={() => setShowCancelModal(false)} activeOpacity={0.7}>
                <Text style={cancelStyles.keepText}>Keep ride</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── MODE: start / destination ────────────────
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={getInitialRegion()}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={handleMapPress}
      >
        {selectedLocation?.latitude && selectedLocation?.longitude && (
          <Marker coordinate={selectedLocation} draggable onDragEnd={handleMarkerDragEnd} />
        )}
      </MapView>

      <TouchableOpacity style={styles.locationButton} onPress={goToCurrentLocation} activeOpacity={0.8}>
        <Ionicons name="locate" size={20} color="#007AFF" />
      </TouchableOpacity>

      <View style={styles.bottomSheetFixed}>
        <View style={styles.dragHandle} />
        <Text style={styles.title}>
          {selectionType === "start" ? "Set pickup location" : "Set destination"}
        </Text>
        {loadingAddress ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#666" />
            <Text style={styles.loadingText}>Loading address...</Text>
          </View>
        ) : (
          <Text style={styles.address}>{selectedAddress || "Tap on map"}</Text>
        )}
        <TouchableOpacity
          style={[styles.confirmBtn, (!selectedLocation || loadingAddress) && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!selectedLocation || loadingAddress}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  card: {
    alignItems: "center",
  },
  iconContainer: {
    position: "relative",
    marginBottom: 20,
    marginTop: 8,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  iconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  button: {
    backgroundColor: "#000",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 50,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

const styles = StyleSheet.create({
  // Top label for saved_address mode
  topLabelContainer: {
    position: "absolute", top: 50, left: 20, right: 20, zIndex: 10,
  },
  topLabelCard: {
    backgroundColor: "#FFF",
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
  },
  topLabelText: { fontSize: 14, color: "#444", flex: 1 },
  container: { flex: 1, backgroundColor: "#FFF" },
  map: { flex: 1 },
  topAddresses: {
    position: "absolute",
    top: 10,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  addressCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  addressSeparator: { height: 10 },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
  },
  dotRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#3B82F6",
  },
  addressText: {
    fontSize: 15,
    color: "#202124",
    flex: 1,
    fontWeight: "500",
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#DADCE0",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 12,
  },
  loadingText: {
    fontSize: 15,
    color: "#666",
    fontStyle: "italic",
  },
  recommendedSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F9FA",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  recommendedContent: { flex: 1 },
  recommendedTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  distanceText: {
    fontSize: 14,
    color: "#5F6368",
  },
  cancelRideButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FEE2E2",
  },
  cancelRideText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#E53E3E",
  },
  bottomSheetFixed: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: "#FFF",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
  },
  address: {
    fontSize: 15,
    color: "#666",
    marginBottom: 16,
  },
  confirmBtn: {
    backgroundColor: "#000",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmBtnDisabled: {
    backgroundColor: "#CCC",
    opacity: 0.6,
  },
  confirmText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
  },
  // ── Route info row: distance·durée  +  prix ──
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  routeMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  routeMetaText: {
    fontSize: 13, color: '#666', fontWeight: '500',
  },
  priceChip: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 10, color: '#999', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  priceValue: {
    fontSize: 20, fontWeight: '800', color: '#111',
  },
  locationButton: {
  position: 'absolute',
  right: 16,
  bottom: 110,
  width: 44, height: 44, borderRadius: 22,
  backgroundColor: '#fff',
  justifyContent: 'center', alignItems: 'center',
  shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12, shadowRadius: 8,
  elevation: 30, zIndex: 999,
},
});
// ── Route mode styles ─────────────────────────────────────────────────────────
const routeStyles = StyleSheet.create({
  topCard: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  addressDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 22,
  },
  dotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
  },
  dotBlue: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },

  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  priceLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.5,
  },
  priceCurrency: {
    fontSize: 20,
    fontWeight: '700',
    color: '#555',
  },
  metaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CCC',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },

  ctaButton: {
  backgroundColor: '#111',
  borderRadius: 20,
  paddingVertical: 18,
  paddingHorizontal: 20,
  marginBottom: 10,
},
ctaInner: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
ctaLabel: {
  fontSize: 11,
  fontWeight: '500',
  color: '#888',
  marginBottom: 2,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
},
ctaText: {
  fontSize: 20,
  fontWeight: '800',
  color: '#fff',
  letterSpacing: -0.3,
},
ctaArrow: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#fff',
  alignItems: 'center',
  justifyContent: 'center',
},
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});
const cancelStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmBtn: {
    width: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  keepBtn: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  keepText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
});

// ── wzStyles — add these to your StyleSheet ──────────────────────────────────
const wzStyles = StyleSheet.create({
  // Pin fixe au centre
  pinWrap: {
    position:        'absolute',
    top:             '50%',
    left:            '50%',
    marginLeft:      -20,
    marginTop:       -40,
    alignItems:      'center',
  },
  pinShadow: {
    width:           10,
    height:          4,
    borderRadius:    5,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginTop:       -2,
  },

  // Floating pill
  floatingPill: {
    position:          'absolute',
    top:               '50%',
    left:              24,
    right:             24,
    marginTop:         10,
    backgroundColor:   '#1a1a2e',
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical:   8, 
    alignItems:        'center',
    shadowColor:       '#000000',
    shadowOpacity:     0.25,
    shadowRadius:      12,
    shadowOffset:      { width: 0, height: 4 },
    elevation:         8,
  },
  floatingHint: {
    fontSize:      10,
    color:         'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    fontWeight:    '600',
    marginBottom:  4,
  },
  floatingAddress: {
    fontSize:   14,
    color:      '#fff',
    fontWeight: '600',
    textAlign:  'center',
  },

  // Bottom bar
  bottomBar: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 24,
    paddingBottom:     40,
    paddingTop:        16,
    backgroundColor:   'transparent',
  },
  cta: {
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#0a3980',
    borderRadius:    50,  
    paddingVertical: 14,        
    paddingHorizontal: 170,     
    alignSelf:       'center',  
  },
  ctaDisabled: {
    backgroundColor: 'rgba(41,65,144,0.4)',
  },
  ctaText: {
    color:         '#fff',
    fontSize:      16,
    fontWeight:    '700',
    letterSpacing: -0.2,
  },
  errorOverlay: {
  flex:              1,
  backgroundColor:   'rgba(0,0,0,0.45)',
  alignItems:        'center',
  justifyContent:    'center',
  paddingHorizontal: 32,
},
errorCard: {
  backgroundColor:   '#fff',
  borderRadius:      24,
  paddingHorizontal: 24,
  paddingVertical:   28,
  alignItems:        'center',
  width:             '100%',
  shadowColor:       '#000',
  shadowOpacity:     0.12,
  shadowRadius:      20,
  elevation:         10,
},
errorIconCircle: {
  width:           56,
  height:          56,
  borderRadius:    28,
  backgroundColor: '#FEE2E2',
  alignItems:      'center',
  justifyContent:  'center',
  marginBottom:    16,
},
errorTitle: {
  fontSize:      18,
  fontWeight:    '800',
  color:         '#111',
  marginBottom:  8,
  letterSpacing: -0.3,
},
errorMsg: {
  fontSize:     12,      // ← réduit
  color:        '#888',
  textAlign:    'center',
  lineHeight:   18,      // ← réduit
  marginBottom: 20,      // ← réduit
},
errorBtn: {
  backgroundColor:   '#FEE2E2',
  borderRadius:      14,
  paddingVertical:   14,    // ← plus tall
  paddingHorizontal: 70,    // ← plus large
  width:             '100%', // ← full width
  alignItems:        'center',
},
errorBtnText: {
  color:      '#EF4444',
  fontSize:   16,        // ← plus grand
  fontWeight: '700',
},
});
>>>>>>> 46ff32f16fb87b43f9091e209998127c51f2ff47
