import React, { useContext, useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { LocationContext } from "../../context/LocationContext";
import { reverseGeocode } from "../../utils/reverseGeocode";
import { validateLocationsInAlgeria } from "../../utils/Geovalidation";
import { formatDuration, formatDistance } from "../../utils/formatUtils";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import api from "../../services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";



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

  const [selectedLocation, setSelectedLocation] = useState(
    selectionType === "start" ? startLocation : endLocation
  );
  const [selectedAddress, setSelectedAddress] = useState("");
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [savingAddress, setSavingAddress]     = useState(false); 

  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [isValidRoute, setIsValidRoute] = useState(true);
  const [routeDistance, setRouteDistance] = useState(null);
  const [routeDuration, setRouteDuration] = useState(null);

  const [showLocationError, setShowLocationError] = useState(false);

  const mapRef = useRef(null);
  const debounceTimeout = useRef(null);

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
      const endLatNum = parseCoord(endLat);
      const endLngNum = parseCoord(endLng);

      if (startLatNum && startLngNum && endLatNum && endLngNum) {
        const start = { latitude: startLatNum, longitude: startLngNum };
        const end = { latitude: endLatNum, longitude: endLngNum };
        
        setStartLocation(start);
        setEndLocation(end);
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
        { latitude: endLocation.latitude, longitude: endLocation.longitude },
      ],
      {
        edgePadding: { top: 200, right: 60, bottom: 280, left: 60 },
        animated: true,
      }
    );
  };

  const validateAndFetchRoute = async () => {
    const validation = validateLocationsInAlgeria(startLocation, endLocation);
    if (!validation.valid) {
      setIsValidRoute(false);
      setRouteCoordinates([]);
      setRouteDistance(null);
      setRouteDuration(null);
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
      const response = await api.post('/ride/calculate', {
        start: startLocation,
        end: endLocation,
      });
      const data = response.data;

      if (data.success && data.geometry?.coordinates) {
        const coords = data.geometry.coordinates.map(([lng, lat]) => ({
          latitude: lat,
          longitude: lng,
        }));
        setRouteCoordinates(coords);
        setRouteDistance(parseFloat(data.distanceKm));
        setRouteDuration(parseInt(data.durationMin, 10));

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
        const address = await reverseGeocode(coords);
        setSelectedAddress(address);
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
    if (selectionType === "start") {
      setStartLocation(selectedLocation);
    } else {
      setEndLocation(selectedLocation);
    }
    router.back();
  };

  // ── Confirm for saved_address mode ─────────
  const handleConfirmSavedAddress = async () => {
   if (!selectedLocation || !selectedAddress) return;
   setSavingAddress(true);
    try {
      const label = targetLabel || 'Saved place';
      const lat   = selectedLocation.latitude;
      const lng   = selectedLocation.longitude;
      const address = selectedAddress;

      // Cherche si un place avec ce label existe déjà
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
  

  const handleCancelRide = () => {
    if (!rideId) {
      router.push("/passenger/SearchRideScreen");
      return;
    }

    Alert.alert(
      "Cancel Ride",
      "Are you sure you want to cancel this ride?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              console.log('🔄 Cancelling ride ID:', rideId);
              const response = await api.put(`/ridesDem/${rideId}/cancel`);
              console.log(`✅ Ride ${rideId} cancelled`, response.data);
            } catch (error) {
              console.error('❌ Erreur cancel:', error.response?.data || error.message);
            } finally {
              router.push("/passenger/SearchRideScreen");
            }
          },
        }
      ]
    );
  };

  const handleTryAnother = () => {
    setShowLocationError(false);
    router.push("/passenger/SearchRideScreen");
  };

  const getInitialRegion = () => {
    if (selectionType === "route" && startLocation && endLocation) {
      return {
        latitude: (startLocation.latitude + endLocation.latitude) / 2,
        longitude: (startLocation.longitude + endLocation.longitude) / 2,
        latitudeDelta: Math.abs(startLocation.latitude - endLocation.latitude) * 1.5 || 0.1,
        longitudeDelta: Math.abs(startLocation.longitude - endLocation.longitude) * 1.5 || 0.1,
      };
    }
    return {
      latitude: currentLocation?.latitude ?? 36.7538,
      longitude: currentLocation?.longitude ?? 3.0588,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  };

  if (!currentLocation) return null;
   // ════════════════════════════════════════════
  // MODE: saved_address  (new mode)
  // ════════════════════════════════════════════
  if (selectionType === "saved_address") {
    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={getInitialRegion()}
          showsUserLocation
          onPress={handleMapPress}
        >
          {selectedLocation?.latitude && selectedLocation?.longitude && (
            <Marker
              coordinate={selectedLocation}
              draggable
              onDragEnd={handleMarkerDragEnd}
            />
          )}
        </MapView>

        {/* Bottom sheet */}
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
            style={[
              styles.confirmBtn,
              (!selectedLocation || loadingAddress || savingAddress) && styles.confirmBtnDisabled,
            ]}
            onPress={handleConfirmSavedAddress}
            disabled={!selectedLocation || loadingAddress || savingAddress}
            activeOpacity={0.8}
          >
            {savingAddress ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.confirmText}>Save address</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }
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
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#caab2c"
              strokeWidth={2.5}
            />
          )}
        </MapView>

        <View style={styles.topAddresses}>
          <View style={styles.addressCard}>
            <View style={styles.addressRow}>
              <View style={styles.dotGreen} />
              <Text style={styles.addressText} numberOfLines={1}>
                {startAddress || "Departure"}
              </Text>
            </View>
            <View style={styles.addressSeparator} />
            <View style={styles.addressRow}>
              <View style={styles.dotRed} />
              <Text style={styles.addressText} numberOfLines={1}>
                {endAddress || "Destination"}
              </Text>
            </View>
          </View>
        </View>

        {showLocationError ? (
          <LocationNotSupported onTryAnother={handleTryAnother} />
        ) : (
          <View style={styles.bottomSheet}>
            <View style={styles.dragHandle} />

            {loadingRoute ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#000" />
                <Text style={styles.loadingText}>Calculating route...</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.recommendedSection}
                  onPress={() =>
                    router.push({
                      pathname: "/passenger/RecommendedDriversScreen",
                      params: { rideId, startAddress, endAddress },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.recommendedContent}>
                    <Text style={styles.recommendedTitle}>Recommended Drivers</Text>
                    {routeDistance && routeDuration && (
                      <Text style={styles.distanceText}>
                        {formatDistance(routeDistance)} • {formatDuration(routeDuration)}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#666" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelRideButton}
                  onPress={handleCancelRide}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelRideText}>Cancel Ride</Text>
                  <Ionicons name="close-circle" size={22} color="#E53E3E" />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={getInitialRegion()}
        showsUserLocation
        onPress={handleMapPress}
      >
        {selectedLocation?.latitude && selectedLocation?.longitude && (
          <Marker
            coordinate={selectedLocation}
            draggable
            onDragEnd={handleMarkerDragEnd}
          />
        )}
      </MapView>

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
    backgroundColor: "#E53E3E",
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
});