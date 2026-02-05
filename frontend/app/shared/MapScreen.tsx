import React, { useContext, useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  PanResponder,
  ScrollView,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { LocationContext } from "../../context/LocationContext";
import { calculateDistance } from "../../utils/geoUtils";
import { reverseGeocode } from "../../utils/reverseGeocode";
import { validateLocationsInAlgeria } from "../../utils/Geovalidation";
import { formatDuration, formatDistance } from "../../utils/formatUtils";
import { useLocalSearchParams, useRouter } from "expo-router";
import api from "../../services/api";

export default function MapScreen() {
  const router = useRouter();
  const { selectionType } = useLocalSearchParams();

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
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(false);

  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [instructions, setInstructions] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isValidRoute, setIsValidRoute] = useState(true);

  const mapRef = useRef(null);
  const debounceTimeout = useRef(null);

  useEffect(() => {
    if (selectionType === "route" && startLocation && endLocation) {
      validateAndFetchRoute();
    }
  }, [selectionType, startLocation, endLocation]);

  useEffect(() => {
    if (selectionType === "route" && startLocation && endLocation && mapRef.current) {
      setTimeout(() => {
        centerMapOnMarkers();
      }, 500);
    }
  }, [selectionType, startLocation, endLocation]);

  useEffect(() => {
    if (selectionType !== "route" && currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [currentLocation, selectionType]);

  useEffect(() => {
    if (selectionType !== "route" && currentLocation && selectedLocation) {
      const d = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        selectedLocation.latitude,
        selectedLocation.longitude
      );

      setDistance(d);
      setDuration((d / 40) * 60);
    }
  }, [currentLocation, selectedLocation, selectionType]);

  const centerMapOnMarkers = () => {
    if (!mapRef.current || !startLocation || !endLocation) return;

    const coordinates = [
      {
        latitude: startLocation.latitude,
        longitude: startLocation.longitude,
      },
      {
        latitude: endLocation.latitude,
        longitude: endLocation.longitude,
      },
    ];

    console.log('📍 Centrage de la carte sur les marqueurs');

    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
      animated: true,
    });
  };

  const validateAndFetchRoute = async () => {
    const validation = validateLocationsInAlgeria(startLocation, endLocation);

    if (!validation.valid) {
      console.log('⚠️ Points hors Algérie:', validation.message);
      
      setIsValidRoute(false);
      setRouteCoordinates([]);
      setInstructions([]);
      setDistance(null);
      setDuration(null);
      setLoadingRoute(false);

      centerMapOnMarkers();
      return;
    }

    console.log('✅ Points en Algérie - Calcul de l\'itinéraire');
    setIsValidRoute(true);
    fetchRoute();
  };

  const fetchRoute = async () => {
    setLoadingRoute(true);
    try {
      console.log('🚀 Appel API pour calculer l\'itinéraire...');
      
      const response = await api.post('/ride/calculate', {
        start: startLocation,
        end: endLocation
      });

      const data = response.data;

      if (data.success && data.geometry?.coordinates) {
        const coords = data.geometry.coordinates.map(([lng, lat]) => ({
          latitude: lat,
          longitude: lng,
        }));

        console.log('✅ Itinéraire reçu:', coords.length, 'points');

        setRouteCoordinates(coords);
        setInstructions(data.steps || []);

        const distanceKm = parseFloat(data.distanceKm);
        const durationMin = parseInt(data.durationMin, 10);
        
        console.log('📊 Distance:', distanceKm, 'km');
        console.log('⏱️ Durée:', durationMin, 'min');
        console.log('🎨 Formaté:', formatDuration(durationMin));
        
        setDistance(distanceKm);
        setDuration(durationMin);

        if (mapRef.current && coords.length > 0) {
          mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
            animated: true,
          });
        }
      } else {
        console.log('⚠️ Pas d\'itinéraire dans la réponse');
        centerMapOnMarkers();
      }
    } catch (error) {
      console.error('❌ Erreur lors du calcul de l\'itinéraire:', error);
      
      setRouteCoordinates([]);
      setIsValidRoute(false);
      centerMapOnMarkers();
    } finally {
      setLoadingRoute(false);
    }
  };

  const fetchAddress = async (coords) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(async () => {
      setLoadingAddress(true);
      try {
        const address = await reverseGeocode(coords);
        setSelectedAddress(address);
      } catch (error) {
        console.error("Erreur reverse geocode:", error);
        setSelectedAddress("Erreur de chargement");
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
    if (selectionType === "route") {
      router.push("/passenger/SearchRideScreen");
      return;
    }

    if (!selectedLocation) return;

    if (selectionType === "start") {
      setStartLocation(selectedLocation);
    } else {
      setEndLocation(selectedLocation);
    }

    router.push("/passenger/SearchRideScreen");
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: () => {},
      onPanResponderRelease: (_, g) => {
        if (g.dy < -80) {
          router.push("/passenger/SearchRideScreen");
        }
      },
    })
  ).current;

  if (!currentLocation) return null;

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
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  };

  if (selectionType === "route") {
    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={getInitialRegion()}
          showsUserLocation
        >
          {startLocation && startLocation.latitude && startLocation.longitude && (
            <Marker
              coordinate={startLocation}
              pinColor="green"
              title="Départ"
            />
          )}

          {endLocation && endLocation.latitude && endLocation.longitude && (
            <Marker
              coordinate={endLocation}
              pinColor="red"
              title="Destination"
            />
          )}

          {isValidRoute && routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#d12d5e"
              strokeWidth={2.5}
            />
          )}
        </MapView>

        <View style={styles.bottomSheet}>
          <View style={styles.dragHandle} />

          <Text style={styles.title}>Itinéraire</Text>

          {loadingRoute && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loadingText}>Calcul de l'itinéraire...</Text>
            </View>
          )}

          {!loadingRoute && !isValidRoute && (
            <View style={styles.infoContainer}>
              <Text style={styles.infoTextGray}>
                📍 Trajet hors zone de couverture
              </Text>
            </View>
          )}

          {!loadingRoute && isValidRoute && distance && duration && (
            <View style={styles.infoContainer}>
              <Text style={styles.info}>
                {formatDistance(distance)} • {formatDuration(duration)}
              </Text>
              {instructions.length > 0 && (
                <TouchableOpacity
                  style={styles.instructionsBtn}
                  onPress={() => setShowInstructions(!showInstructions)}
                >
                  <Text style={styles.instructionsBtnText}>
                    {showInstructions ? "Masquer" : "Instructions"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {showInstructions && instructions.length > 0 && isValidRoute && (
            <ScrollView style={styles.instructionsContainer}>
              {instructions.map((step, index) => (
                <View key={index} style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>{index + 1}</Text>
                  <View style={styles.instructionContent}>
                    <Text style={styles.instructionText}>
                      {step.maneuver?.modifier || step.maneuver?.type || "Continue"}
                    </Text>
                    <Text style={styles.instructionDistance}>
                      {formatDistance(step.distance / 1000)}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleConfirm}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={getInitialRegion()}
        showsUserLocation
        onPress={handleMapPress}
      >
        {selectedLocation && selectedLocation.latitude && selectedLocation.longitude && (
          <Marker
            coordinate={selectedLocation}
            draggable
            onDragEnd={handleMarkerDragEnd}
          />
        )}
      </MapView>

      <View style={styles.bottomSheet} {...panResponder.panHandlers}>
        <View style={styles.dragHandle} />

        <Text style={styles.title}>
          {selectionType === "start"
            ? "Set pickup location"
            : "Set destination"}
        </Text>

        {loadingAddress ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#666" />
            <Text style={styles.loadingText}>Chargement de l'adresse...</Text>
          </View>
        ) : (
          <Text style={styles.address}>
            {selectedAddress || "Tap on map"}
          </Text>
        )}

        {distance && duration && (
          <Text style={styles.info}>
            {formatDistance(distance)} • {formatDuration(duration)}
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.confirmBtn,
            (!selectedLocation || loadingAddress) && styles.confirmBtnDisabled,
          ]}
          onPress={handleConfirm}
          disabled={!selectedLocation || loadingAddress}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  map: {
    flex: 1,
  },

  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: "70%",
    minHeight: 150, 
  },

  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#ccc",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 10,
  },

  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 10, 
  },

  address: {
    marginTop: 10,
    fontSize: 16,
    color: "#555",
  },

  loadingContainer: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5, 
  },

  loadingText: {
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
  },

  info: {
    fontSize: 14,
    color: "#777",
  },

  infoTextGray: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
  },

  infoContainer: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 30,
  },

  instructionsBtn: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },

  instructionsBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  instructionsContainer: {
    marginTop: 10,
    maxHeight: 200,
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 10,
  },

  instructionItem: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-start",
  },

  instructionNumber: {
    width: 24,
    height: 24,
    backgroundColor: "#007AFF",
    color: "#fff",
    borderRadius: 12,
    textAlign: "center",
    lineHeight: 24,
    fontSize: 12,
    fontWeight: "600",
    marginRight: 10,
  },

  instructionContent: {
    flex: 1,
  },

  instructionText: {
    fontSize: 14,
    color: "#000",
    marginBottom: 2,
  },

  instructionDistance: {
    fontSize: 12,
    color: "#666",
  },

  confirmBtn: {
    marginTop: 20,
    backgroundColor: "black",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  confirmBtnDisabled: {
    backgroundColor: "#CCC",
    opacity: 0.6,
  },

  confirmText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});