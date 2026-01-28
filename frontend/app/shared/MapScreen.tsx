import React, { useState, useEffect } from "react";
import { View, StyleSheet ,TextInput, TouchableOpacity, Text } from "react-native";
import MapView, { Marker }  from "react-native-maps";
import * as Location from "expo-location";

export default function MapScreen() {
  const [location, setLocation] = useState(null);
  const [searchText, setSearchText] = useState("");

  //Get user location
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("Permission denied");
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);
  // Search address
  const handleSearch = async () => {
    if (!searchText) return;

    const result = await Location.geocodeAsync(searchText);

    if (result.length > 0) {
      setLocation({
        latitude: result[0].latitude,
        longitude: result[0].longitude,
      });
    }
  };
  return (
    <View style={styles.container}>
    <View style={styles.searchBox}>
        <TextInput
          placeholder="Search address..."
          value={searchText}
          onChangeText={setSearchText}
          style={styles.input}
        />
        <TouchableOpacity onPress={handleSearch} style={styles.searchBtn}>
          <Text style={{ color: "white" }}>Go</Text>
        </TouchableOpacity>
     </View>
      {location && (
        <MapView
          style={styles.map}
          region={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={true}
          zoomControlEnabled={true}
        >
          <Marker coordinate={location} />
        </MapView>
      )}
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

