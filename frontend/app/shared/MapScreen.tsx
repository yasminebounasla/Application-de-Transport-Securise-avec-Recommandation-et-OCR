import React, { useContext, useRef, useEffect, useState } from "react";
import { View, StyleSheet, TextInput, TouchableOpacity, Text } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { LocationContext } from "../../context/LocationContext";

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

  const handleSearchPress = () => {
    if (searchText.trim() !== "") {
      setEndLocation({
        ...endLocation,
        latitude: currentLocation.latitude, 
        longitude: currentLocation.longitude,
      });
      setSearchText(""); 
    }
  };

  return (
    <View style={styles.container}>
      {/* Barre de recherche toujours visible */}
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
      >
        {endLocation && (
          <Marker
            coordinate={endLocation}
            draggable
            onDragEnd={(e) => setEndLocation(e.nativeEvent.coordinate)}
            pinColor="black"
          />
        )}
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
