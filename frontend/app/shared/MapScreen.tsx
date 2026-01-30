import React, { useContext, useRef, useEffect, useState } from "react";
import { View, StyleSheet, TextInput, TouchableOpacity, Text, Alert } from "react-native";
import MapView from "react-native-maps";
import { LocationContext } from "../../context/LocationContext";
import LocationPicker from "../../components/LocationPicker";
import { geocodeAddress } from "../../services/locationService";

export default function MapScreen() {
  const { currentLocation, endLocation, setEndLocation } = useContext(LocationContext);
  const mapRef = useRef<MapView>(null);
  const [searchText, setSearchText] = useState("");

  // Centrer la carte sur la position actuelle
  useEffect(() => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  }, [currentLocation]);

  if (!currentLocation) return null;

  const handleSearchPress = async () => {
    if (!searchText.trim()) return;

    try {
      const coords = await geocodeAddress(searchText);
      if (!coords) {
        Alert.alert("Adresse introuvable");
        return;
      }

      setEndLocation(coords);

      // Déplacer le marker et centrer la carte
      mapRef.current?.animateToRegion(
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );

      setSearchText(""); // reset input
    } catch (error) {
      Alert.alert("Erreur", "Impossible de trouver cette adresse");
    }
  };
  return (
    <View style={styles.container}>
      {/* Barre de recherche */}
      <View style={styles.searchBox}>
        <TextInput
          placeholder="Search address..."
          value={searchText}
          onChangeText={setSearchText}
          style={styles.input}
        />
        <TouchableOpacity onPress={handleSearchPress} style={styles.searchBtn}>
          <Text style={{ color: "white" }}>Go</Text>
        </TouchableOpacity>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        zoomControlEnabled={true}
        onPress={(event) => {
          const coords = event.nativeEvent.coordinate;
          setEndLocation(coords);
        }}
      >
        <LocationPicker
          mapRef={mapRef}
          searchLocation={endLocation} 
        />
      </MapView>
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
  searchBox: {
    position: "absolute",
    top: 40,
    left: 10,
    right: 10,
    flexDirection: "row",
    backgroundColor: "white",
    zIndex: 1,
    borderRadius: 8,
    padding: 5,
  },
  input: {
    flex: 1,
    padding: 8,
  },
  searchBtn: {
    backgroundColor: "black",
    padding: 10,
    borderRadius: 5,
  },
});



