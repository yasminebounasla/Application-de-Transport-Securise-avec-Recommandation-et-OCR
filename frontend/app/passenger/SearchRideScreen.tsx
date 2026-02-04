import React, { useContext, useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  FlatList,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { LocationContext } from "../../context/LocationContext";
import { reverseGeocode } from "../../utils/reverseGeocode";
import { searchPlaces } from "../../services/placesService";
import { Ionicons } from '@expo/vector-icons';

type FocusedField = 'start' | 'destination' | null;

export default function SearchRideScreen() {
  const router = useRouter();
  const { currentLocation, startLocation, setStartLocation, endLocation, setEndLocation } = useContext(LocationContext);

  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingEnd, setLoadingEnd] = useState(false);

  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const startInputRef = useRef<TextInput>(null);
  const endInputRef = useRef<TextInput>(null);

  const [startQuery, setStartQuery] = useState("");
  const [endQuery, setEndQuery] = useState("");
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions] = useState([]);
  const [loadingStartSuggestions, setLoadingStartSuggestions] = useState(false);
  const [loadingEndSuggestions, setLoadingEndSuggestions] = useState(false);

  // Charger l'adresse de départ
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
        setStartQuery(""); 
      } catch (error) {
        console.error("Erreur chargement adresse départ:", error);
        setStartAddress("Erreur de chargement");
      } finally {
        setLoadingStart(false);
      }
    };

    loadStartAddress();
  }, [startLocation?.latitude, startLocation?.longitude]);

  // Charger l'adresse de destination
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
        setEndQuery("");
      } catch (error) {
        console.error("Erreur chargement adresse destination:", error);
        setEndAddress("Erreur de chargement");
      } finally {
        setLoadingEnd(false);
      }
    };

    loadEndAddress();
  }, [endLocation?.latitude, endLocation?.longitude]);

  // Autocomplete pour "From"
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (startQuery.length < 2) {
        setStartSuggestions([]);
        return;
      }

      setLoadingStartSuggestions(true);
      try {
        const results = await searchPlaces(startQuery, currentLocation);
        setStartSuggestions(results);
      } catch (error) {
        console.error("Erreur autocomplete:", error);
      } finally {
        setLoadingStartSuggestions(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timer);
  }, [startQuery]);

  // Autocomplete pour "Where to"
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (endQuery.length < 2) {
        setEndSuggestions([]);
        return;
      }

      setLoadingEndSuggestions(true);
      try {
        const results = await searchPlaces(endQuery, currentLocation);
        setEndSuggestions(results);
      } catch (error) {
        console.error("Erreur autocomplete:", error);
      } finally {
        setLoadingEndSuggestions(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timer);
  }, [endQuery]);

  const handleStartFocus = () => {
    setFocusedField('start');
    setStartQuery(startAddress); 
  };

  const handleEndFocus = () => {
    setFocusedField('destination');
    setEndQuery(endAddress);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setFocusedField(null);
    }, 200);
  };

  const handleCurrentPosition = async () => {
    if (currentLocation) {
      setStartLocation(currentLocation);
      setFocusedField(null);
      Keyboard.dismiss();
    }
  };

  const handleSetOnMapStart = () => {
    setFocusedField(null);
    Keyboard.dismiss();
    router.push("/shared/MapScreen?selectionType=start");
  };

  const handleSetOnMapEnd = () => {
    setFocusedField(null);
    Keyboard.dismiss();
    router.push("/shared/MapScreen?selectionType=destination");
  };

  const handleSelectStartSuggestion = (place: any) => {
    const location = {
      latitude: place.latitude,
      longitude: place.longitude
    };
    setStartLocation(location);
    setFocusedField(null);
    Keyboard.dismiss();
  };

  const handleSelectEndSuggestion = (place: any) => {
    const location = {
      latitude: place.latitude,
      longitude: place.longitude
    };
    setEndLocation(location);
    setFocusedField(null);
    Keyboard.dismiss();
  };

  const handleSearchRides = () => {
    if (startLocation && endLocation) {
      router.push("/shared/MapScreen?selectionType=view");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Book a Ride</Text>

      {/* Champ FROM */}
      <View style={styles.fieldContainer}>
        <View style={styles.inputContainer}>
          {loadingStart ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#666" />
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : (
            <TextInput
              ref={startInputRef}
              placeholder="From?"
              value={focusedField === 'start' ? startQuery : startAddress}
              onChangeText={setStartQuery}
              onFocus={handleStartFocus}
              onBlur={handleBlur}
              style={styles.input}
              placeholderTextColor="#999"
            />
          )}
        </View>

        {/* Options sous "From" */}
        {focusedField === 'start' && (
          <View style={styles.optionsContainer}>
            {/* Current Position */}
            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleCurrentPosition}
              activeOpacity={0.7}
            >
              <Ionicons name="location" size={20} color="#000" style={styles.optionIcon} />
              <Text style={styles.optionText}>Current position</Text>
            </TouchableOpacity>

            {/* Set on Map */}
            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleSetOnMapStart}
              activeOpacity={0.7}
            >
              <Ionicons name="map-outline" size={20} color="#000" style={styles.optionIcon} />
              <Text style={styles.optionText}>Set on map</Text>
            </TouchableOpacity>

            {/* Suggestions */}
            {loadingStartSuggestions && <ActivityIndicator style={{ marginTop: 10 }} />}
            
            {startSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {startSuggestions.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectStartSuggestion(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="location-outline" size={18} color="#666" style={styles.suggestionIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionTitle}>{item.shortName}</Text>
                      <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Champ WHERE TO */}
      <View style={styles.fieldContainer}>
        <View style={styles.inputContainer}>
          {loadingEnd ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#666" />
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : (
            <TextInput
              ref={endInputRef}
              placeholder="Where to?"
              value={focusedField === 'destination' ? endQuery : endAddress}
              onChangeText={setEndQuery}
              onFocus={handleEndFocus}
              onBlur={handleBlur}
              style={styles.input}
              placeholderTextColor="#999"
            />
          )}
        </View>

        {/* Options sous "Where to" */}
        {focusedField === 'destination' && (
          <View style={styles.optionsContainer}>
            {/* Set on Map SEULEMENT */}
            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleSetOnMapEnd}
              activeOpacity={0.7}
            >
              <Ionicons name="map-outline" size={20} color="#000" style={styles.optionIcon} />
              <Text style={styles.optionText}>Set on map</Text>
            </TouchableOpacity>

            {/* Suggestions */}
            {loadingEndSuggestions && <ActivityIndicator style={{ marginTop: 10 }} />}
            
            {endSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {endSuggestions.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectEndSuggestion(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="location-outline" size={18} color="#666" style={styles.suggestionIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionTitle}>{item.shortName}</Text>
                      <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Bouton Search Rides */}
      <TouchableOpacity
        style={[
          styles.searchButton,
          (!startLocation || !endLocation || loadingStart || loadingEnd) && styles.disabled,
        ]}
        disabled={!startLocation || !endLocation || loadingStart || loadingEnd}
        onPress={handleSearchRides}
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

  fieldContainer: {
    marginBottom: 16,
  },

  inputContainer: {
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 12,
    minHeight: 56,
    justifyContent: "center",
  },

  input: {
    fontSize: 16,
    color: "#000",
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  loadingText: {
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
  },

  // Options sous les champs
  optionsContainer: {
    marginTop: 8,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    padding: 8,
  },

  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FFF",
    borderRadius: 8,
    marginBottom: 6,
  },

  optionIcon: {
    marginRight: 12,
  },

  optionText: {
    fontSize: 15,
    color: "#000",
    fontWeight: "500",
  },

  // Suggestions
  suggestionsContainer: {
    marginTop: 8,
  },

  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FFF",
    borderRadius: 8,
    marginBottom: 6,
  },

  suggestionIcon: {
    marginRight: 12,
  },

  suggestionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },

  suggestionSubtitle: {
    fontSize: 13,
    color: "#666",
  },

  // Bouton Search
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