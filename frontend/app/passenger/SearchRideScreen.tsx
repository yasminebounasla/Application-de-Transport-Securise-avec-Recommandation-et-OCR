import React, { useContext, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { LocationContext } from "../../context/LocationContext";
import { reverseGeocode } from "../../utils/reverseGeocode";

export default function SearchRideScreen() {
  const router = useRouter();
  const { startLocation, endLocation } = useContext(LocationContext);

  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingEnd, setLoadingEnd] = useState(false);

  useEffect(() => {
    const loadStartAddress = async () => {
      if (!startLocation?.latitude || !startLocation?.longitude) {
        setStartAddress("");
        setLoadingStart(false);
        return;
      }

      setLoadingStart(true);
      
      try {
        await new Promise(resolve => setTimeout(resolve, 150));
        const address = await reverseGeocode(startLocation);
        setStartAddress(address);
      } catch (error) {
        console.error("Erreur chargement adresse départ:", error);
        setStartAddress("Erreur de chargement");
      } finally {
        setLoadingStart(false);
      }
    };

    loadStartAddress();
  }, [startLocation?.latitude, startLocation?.longitude]);

  useEffect(() => {
    const loadEndAddress = async () => {
      if (!endLocation?.latitude || !endLocation?.longitude) {
        setEndAddress("");
        setLoadingEnd(false);
        return;
      }

      setLoadingEnd(true);
      
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        const address = await reverseGeocode(endLocation);
        setEndAddress(address);
      } catch (error) {
        console.error("Erreur chargement adresse destination:", error);
        setEndAddress("Erreur de chargement");
      } finally {
        setLoadingEnd(false);
      }
    };

    loadEndAddress();
  }, [endLocation?.latitude, endLocation?.longitude]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Book a Ride</Text>

      <TouchableOpacity
        style={styles.inputContainer}
        onPress={() => router.push("/shared/MapScreen?selectionType=start")}
        activeOpacity={0.7}
      >
        {loadingStart ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#666" />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : (
          <TextInput
            placeholder="From?"
            value={startAddress}
            editable={false}
            style={styles.input}
            placeholderTextColor="#999"
          />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.inputContainer}
        onPress={() => router.push("/shared/MapScreen?selectionType=destination")}
        activeOpacity={0.7}
      >
        {loadingEnd ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#666" />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : (
          <TextInput
            placeholder="Where to?"
            value={endAddress}
            editable={false}
            style={styles.input}
            placeholderTextColor="#999"
          />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.searchButton,
          (!startLocation || !endLocation || loadingStart || loadingEnd) && styles.disabled,
        ]}
        disabled={!startLocation || !endLocation || loadingStart || loadingEnd}
        activeOpacity={0.8}
      >
        <Text style={styles.searchText}>Search Rides</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    color: "#000",
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    minHeight: 56,
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: "#000",
  },

  loadingRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  loadingText: {
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
  },

  searchButton: {
    backgroundColor: "#000",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },

  disabled: {
    backgroundColor: "#CCC",
    opacity: 0.6,
  },

  searchText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});