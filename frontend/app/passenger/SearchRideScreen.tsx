import React, { useContext, useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { LocationContext } from "../../context/LocationContext";
import { useRide } from "../../context/RideContext";
import { reverseGeocode } from "../../utils/reverseGeocode";
import { searchPlaces } from "../../services/placesService";
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function SearchRideScreen() {
  const router = useRouter();
  const { currentLocation, startLocation, setStartLocation, endLocation, setEndLocation } = useContext(LocationContext);
  const { createRide, loading: rideLoading } = useRide();

  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingEnd, setLoadingEnd] = useState(false);

  const [focusedField, setFocusedField] = useState(null);
  const startInputRef = useRef(null);
  const endInputRef = useRef(null);

  const [startQuery, setStartQuery] = useState("");
  const [endQuery, setEndQuery] = useState("");
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions] = useState([]);
  const [loadingStartSuggestions, setLoadingStartSuggestions] = useState(false);
  const [loadingEndSuggestions, setLoadingEndSuggestions] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateDepart, setDateDepart] = useState(null);
  const [heureDepart, setHeureDepart] = useState(null);

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

  const handleClearStart = () => {
    setStartLocation(null);
    setStartAddress("");
    setStartQuery("");
    setStartSuggestions([]);
    setFocusedField('start');
    startInputRef.current?.focus();
  };

  const handleClearEnd = () => {
    setEndLocation(null);
    setEndAddress("");
    setEndQuery("");
    setEndSuggestions([]);
    setFocusedField('destination');
    endInputRef.current?.focus();
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

  const handleSelectStartSuggestion = (place) => {
    const location = {
      latitude: place.latitude,
      longitude: place.longitude
    };
    setStartLocation(location);
    setFocusedField(null);
    Keyboard.dismiss();
  };

  const handleSelectEndSuggestion = (place) => {
    const location = {
      latitude: place.latitude,
      longitude: place.longitude
    };
    setEndLocation(location);
    setFocusedField(null);
    Keyboard.dismiss();
  };

  const handleOpenDatePicker = () => {
    setShowDatePicker(true);
  };

  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (date) {
      setSelectedDate(date);
      if (Platform.OS === 'android') {
        setTimeout(() => setShowTimePicker(true), 100);
      }
    }
  };

  const handleTimeChange = (event, time) => {
    setShowTimePicker(false);
    
    if (time) {
      const combinedDateTime = new Date(selectedDate);
      combinedDateTime.setHours(time.getHours());
      combinedDateTime.setMinutes(time.getMinutes());
      
      setDateDepart(combinedDateTime);
      setHeureDepart(
        `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`
      );
      
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    }
  };

  const handleApplyDateTime = () => {
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const handleCancelDateTime = () => {
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const formatDisplayDate = () => {
    if (!dateDepart) return "Select date & time";
    
    const options = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return dateDepart.toLocaleDateString('en-US', options);
  };

  const handleSearchRides = async () => {
    if (!startLocation || !endLocation || !dateDepart) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    try {
      const rideData = {
        startLat: startLocation.latitude,
        startLng: startLocation.longitude,
        startAddress: startAddress || "Departure point",
        endLat: endLocation.latitude,
        endLng: endLocation.longitude,
        endAddress: endAddress || "Destination",
        departureTime: dateDepart.toISOString(),
      };

      console.log('📤 Creating ride:', rideData);

      const newRide = await createRide(rideData);

      console.log('✅ Ride created successfully:', newRide);

      Alert.alert(
        'Request created!',
        'Your ride request has been sent to drivers.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.push("/shared/MapScreen?selectionType=route");
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Error creating ride:', error);
      
      let errorMessage = 'Unable to create your request. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const isFormValid = () => {
    return startLocation && endLocation && dateDepart && !loadingStart && !loadingEnd && !rideLoading;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Book a Ride</Text>

      <View style={styles.fieldContainer}>
        <View style={styles.inputContainer}>
          {loadingStart ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#666" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : (
            <>
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
              {(startAddress || startQuery) && (
                <TouchableOpacity
                  onPress={handleClearStart}
                  style={styles.clearButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {focusedField === 'start' && (
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleCurrentPosition}
              activeOpacity={0.7}
            >
              <Ionicons name="location" size={20} color="#000" style={styles.optionIcon} />
              <Text style={styles.optionText}>Current position</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleSetOnMapStart}
              activeOpacity={0.7}
            >
              <Ionicons name="map-outline" size={20} color="#000" style={styles.optionIcon} />
              <Text style={styles.optionText}>Set on map</Text>
            </TouchableOpacity>

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
                      <Text style={styles.suggestionTitle}>{item.displayName}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.fieldContainer}>
        <View style={styles.inputContainer}>
          {loadingEnd ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#666" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : (
            <>
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
              {(endAddress || endQuery) && (
                <TouchableOpacity
                  onPress={handleClearEnd}
                  style={styles.clearButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {focusedField === 'destination' && (
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleSetOnMapEnd}
              activeOpacity={0.7}
            >
              <Ionicons name="map-outline" size={20} color="#000" style={styles.optionIcon} />
              <Text style={styles.optionText}>Set on map</Text>
            </TouchableOpacity>

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
                      <Text style={styles.suggestionTitle}>{item.displayName}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.dateTimeButton}
        onPress={handleOpenDatePicker}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={24} color="#6B46C1" />
        <Text style={[
          styles.dateTimeText,
          dateDepart && styles.dateTimeTextSelected
        ]}>
          {formatDisplayDate()}
        </Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && showDatePicker && (
        <Modal
          transparent
          animationType="slide"
          visible={showDatePicker}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.datePickerContainer}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={handleCancelDateTime}>
                  <Text style={styles.cancelButton}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>
                  {showTimePicker ? 'Time' : 'Select Date'}
                </Text>
                <TouchableOpacity onPress={handleApplyDateTime}>
                  <Text style={styles.applyButton}>Apply</Text>
                </TouchableOpacity>
              </View>

              {!showTimePicker ? (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="inline"
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                  textColor="#000"
                />
              ) : (
                <DateTimePicker
                  value={selectedDate}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                  textColor="#000"
                />
              )}

              {!showTimePicker && (
                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={styles.nextButtonText}>Next: Select Time</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}

      <TouchableOpacity
        style={[
          styles.searchButton,
          !isFormValid() && styles.disabled,
        ]}
        disabled={!isFormValid()}
        onPress={handleSearchRides}
        activeOpacity={0.8}
      >
        {rideLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.searchText}>Create Ride Request</Text>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 12,
    minHeight: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#000",
  },
  clearButton: {
    marginLeft: 8,
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
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dateTimeText: {
    fontSize: 16,
    color: '#999',
    marginLeft: 12,
    flex: 1,
  },
  dateTimeTextSelected: {
    color: '#000',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerContainer: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  cancelButton: {
    fontSize: 16,
    color: '#6B46C1',
  },
  applyButton: {
    fontSize: 16,
    color: '#6B46C1',
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#6B46C1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
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