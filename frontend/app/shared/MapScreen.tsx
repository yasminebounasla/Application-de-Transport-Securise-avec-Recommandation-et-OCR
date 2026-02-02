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
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { LocationContext } from "../../context/LocationContext";
import { calculateDistance } from "../../utils/geoUtils";
import { reverseGeocode } from "../../utils/reverseGeocode";
import { useLocalSearchParams, useRouter } from "expo-router";

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

  const mapRef = useRef(null);
  const debounceTimeout = useRef(null);

  useEffect(() => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [currentLocation]);

  useEffect(() => {
    if (currentLocation && selectedLocation) {
      const d = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        selectedLocation.latitude,
        selectedLocation.longitude
      );

      setDistance(d);
      setDuration((d / 40) * 60);
    }
  }, [currentLocation, selectedLocation]);

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
    const coords = e.nativeEvent.coordinate;
    setSelectedLocation(coords);
    fetchAddress(coords);
  };

  const handleMarkerDragEnd = (e) => {
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
        onPress={handleMapPress}
      >
        {selectedLocation && (
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
            {distance.toFixed(2)} km • {Math.round(duration)} min
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
  map: { flex: 1 },

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
  },

  loadingText: {
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
  },

  info: {
    marginTop: 10,
    fontSize: 14,
    color: "#777",
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