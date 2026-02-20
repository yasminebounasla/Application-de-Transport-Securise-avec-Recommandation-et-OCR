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
  ScrollView,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationContext } from "../../context/LocationContext";
import { useRide } from "../../context/RideContext";
import { reverseGeocode } from "../../utils/reverseGeocode";
import { searchPlaces } from "../../services/placesService";
import { validateLocationsInAlgeria } from "../../utils/Geovalidation";
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const SAVED_ADDRESSES_KEY = 'saved_addresses';

type SavedAddress = { name: string; address: string; lat?: number; lng?: number } | null;
type SavedAddresses = { home: SavedAddress; work: SavedAddress; other: SavedAddress };
type CustomPlace = { id: string; name: string; address: string; lat?: number; lng?: number };

function SavedChip({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.chip} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon as any} size={14} color="#111" style={{ marginRight: 5 }} />
      <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function SavedPlacesSection({
  savedAddresses,
  customPlaces,
  onSelect,
}: {
  savedAddresses: SavedAddresses;
  customPlaces: CustomPlace[];
  onSelect: (place: { address: string; lat?: number; lng?: number }) => void;
}) {
  const fixed = [
    { key: 'home',  icon: 'home',      label: 'Home',  data: savedAddresses.home },
    { key: 'work',  icon: 'briefcase', label: 'Work',  data: savedAddresses.work },
    { key: 'other', icon: 'location',  label: 'Other', data: savedAddresses.other },
  ].filter(p => p.data !== null);

  const all = [
    ...fixed.map(p => ({ id: p.key, icon: p.icon, label: p.label, address: p.data!.address, lat: p.data!.lat, lng: p.data!.lng })),
    ...customPlaces.map(p => ({ id: p.id, icon: 'bookmark-outline', label: p.name, address: p.address, lat: p.lat, lng: p.lng })),
  ];

  if (all.length === 0) return null;

  return (
    <View style={styles.savedSection}>
      <Text style={styles.savedSectionTitle}>Saved places</Text>
      {/* Quick chips row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ paddingRight: 8 }}>
        {all.map(p => (
          <SavedChip
            key={p.id}
            icon={p.icon}
            label={p.label}
            onPress={() => onSelect({ address: p.address, lat: p.lat, lng: p.lng })}
          />
        ))}
      </ScrollView>
      {/* Full list rows */}
      {all.map(p => (
        <TouchableOpacity
          key={p.id}
          style={styles.savedRow}
          onPress={() => onSelect({ address: p.address, lat: p.lat, lng: p.lng })}
          activeOpacity={0.7}
        >
          <View style={styles.savedRowIcon}>
            <Ionicons name={p.icon as any} size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.savedRowLabel}>{p.label}</Text>
            <Text style={styles.savedRowAddress} numberOfLines={1}>{p.address}</Text>
          </View>
          <Ionicons name="arrow-forward-outline" size={15} color="#CCC" />
        </TouchableOpacity>
      ))}
    </View>
  );
}


export default function SearchRideScreen() {
  const router = useRouter();
  const { currentLocation, startLocation, setStartLocation, endLocation, setEndLocation } = useContext(LocationContext);
  const { createRide, loading: rideLoading } = useRide();

  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingEnd, setLoadingEnd] = useState(false);

  const [focusedField, setFocusedField] = useState<'start' | 'destination' | null>(null);
  const startInputRef = useRef<TextInput>(null);
  const endInputRef = useRef<TextInput>(null);

  const isSelectingSuggestion = useRef(false);
  const isNavigatingToMap = useRef(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastStartCoords = useRef<string | null>(null);
  const lastEndCoords = useRef<string | null>(null);

  const [startQuery, setStartQuery] = useState("");
  const [endQuery, setEndQuery] = useState("");
  const [startSuggestions, setStartSuggestions] = useState<any[]>([]);
  const [endSuggestions, setEndSuggestions] = useState<any[]>([]);
  const [loadingStartSuggestions, setLoadingStartSuggestions] = useState(false);
  const [loadingEndSuggestions, setLoadingEndSuggestions] = useState(false);

  // ── Saved Addresses state ──────────────────
  const [savedAddresses, setSavedAddresses] = useState<SavedAddresses>({ home: null, work: null, other: null });
  const [customPlaces, setCustomPlaces] = useState<CustomPlace[]>([]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateDepart, setDateDepart] = useState<Date | null>(null);
  const [heureDepart, setHeureDepart] = useState<string | null>(null);

  const [smoking_ok, setSmokingOk] = useState(false);
  const [pets_ok, setPetsOk] = useState(false);
  const [luggage_large, setLuggageLarge] = useState(false);
  const [quiet_ride, setQuietRide] = useState(false);
  const [radio_ok, setRadioOk] = useState(false);
  const [female_driver_pref, setFemaleDriverPref] = useState(false);

  // ── Load saved addresses from AsyncStorage ──
  useEffect(() => {
    const loadSavedAddresses = async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_ADDRESSES_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setSavedAddresses(saved.addresses || { home: null, work: null, other: null });
          setCustomPlaces(saved.custom || []);
        }
      } catch (e) {
        console.error('Failed to load saved addresses:', e);
      }
    };
    loadSavedAddresses();
  }, []);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const loadStartAddress = async () => {
      if (!startLocation?.latitude || !startLocation?.longitude) {
        setStartAddress("");
        setLoadingStart(false);
        lastStartCoords.current = null;
        return;
      }
      const coordsKey = `${startLocation.latitude.toFixed(4)},${startLocation.longitude.toFixed(4)}`;
      if (lastStartCoords.current === coordsKey) return;
      lastStartCoords.current = coordsKey;
      setLoadingStart(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 150));
        const address = await reverseGeocode(startLocation);
        setStartAddress(address);
        setStartQuery("");
      } catch {
        setStartAddress("Error loading address");
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
        lastEndCoords.current = null;
        return;
      }
      const coordsKey = `${endLocation.latitude.toFixed(4)},${endLocation.longitude.toFixed(4)}`;
      if (lastEndCoords.current === coordsKey) return;
      lastEndCoords.current = coordsKey;
      setLoadingEnd(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const address = await reverseGeocode(endLocation);
        setEndAddress(address);
        setEndQuery("");
      } catch {
        setEndAddress("Error loading address");
      } finally {
        setLoadingEnd(false);
      }
    };
    loadEndAddress();
  }, [endLocation?.latitude, endLocation?.longitude]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (startQuery.length < 2) { setStartSuggestions([]); return; }
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
      if (endQuery.length < 2) { setEndSuggestions([]); return; }
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
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setFocusedField('start');
    setStartQuery(startAddress);
  };

  const handleEndFocus = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setFocusedField('destination');
    setEndQuery(endAddress);
  };

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      if (!isSelectingSuggestion.current && !isNavigatingToMap.current) {
        setFocusedField(null);
      }
    }, 400);
  };

  const handleClearStart = () => {
    setStartLocation(null);
    setStartAddress("");
    setStartQuery("");
    setStartSuggestions([]);
    lastStartCoords.current = null;
    setFocusedField('start');
    startInputRef.current?.focus();
  };

  const handleClearEnd = () => {
    setEndLocation(null);
    setEndAddress("");
    setEndQuery("");
    setEndSuggestions([]);
    lastEndCoords.current = null;
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
    isNavigatingToMap.current = true;
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setFocusedField(null);
    Keyboard.dismiss();
    setTimeout(() => {
      isNavigatingToMap.current = false;
      router.push({ pathname: "/shared/MapScreen", params: { selectionType: "start" } });
    }, 50);
  };

  const handleSetOnMapEnd = () => {
    isNavigatingToMap.current = true;
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setFocusedField(null);
    Keyboard.dismiss();
    setTimeout(() => {
      isNavigatingToMap.current = false;
      router.push({ pathname: "/shared/MapScreen", params: { selectionType: "destination" } });
    }, 50);
  };

  const handleSelectStartSuggestion = (place: any) => {
    isSelectingSuggestion.current = false;
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setStartLocation({ latitude: place.latitude, longitude: place.longitude });
    setStartSuggestions([]);
    setFocusedField(null);
    Keyboard.dismiss();
  };

  const handleSelectEndSuggestion = (place: any) => {
    isSelectingSuggestion.current = false;
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setEndLocation({ latitude: place.latitude, longitude: place.longitude });
    setEndSuggestions([]);
    setFocusedField(null);
    Keyboard.dismiss();
  };

  // ── Handle selecting a saved address as START ──
  const handleSelectSavedForStart = (place: { address: string; lat?: number; lng?: number }) => {
    isSelectingSuggestion.current = false;
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    if (place.lat && place.lng) {
      setStartLocation({ latitude: place.lat, longitude: place.lng });
    } else {
      // No coords stored yet — just set address text so user sees it
      setStartAddress(place.address);
    }
    setStartSuggestions([]);
    setFocusedField(null);
    Keyboard.dismiss();
  };

  // ── Handle selecting a saved address as END ──
  const handleSelectSavedForEnd = (place: { address: string; lat?: number; lng?: number }) => {
    isSelectingSuggestion.current = false;
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    if (place.lat && place.lng) {
      setEndLocation({ latitude: place.lat, longitude: place.lng });
    } else {
      setEndAddress(place.address);
    }
    setEndSuggestions([]);
    setFocusedField(null);
    Keyboard.dismiss();
  };

  const handleOpenDatePicker = () => setShowDatePicker(true);

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      if (Platform.OS === 'android') setTimeout(() => setShowTimePicker(true), 100);
    }
  };

  const handleTimeChange = (event: any, time?: Date) => {
    setShowTimePicker(false);
    if (time) {
      const combinedDateTime = new Date(selectedDate);
      combinedDateTime.setHours(time.getHours());
      combinedDateTime.setMinutes(time.getMinutes());
      setDateDepart(combinedDateTime);
      setHeureDepart(
        `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`
      );
      if (Platform.OS === 'ios') setShowDatePicker(false);
    }
  };

  const formatDisplayDate = () => {
    if (!dateDepart) return "Select date & time";
    return dateDepart.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const handleRideRequest = async () => {
    if (!startLocation || !endLocation || !dateDepart) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    const validation = validateLocationsInAlgeria(startLocation, endLocation);
    if (!validation.valid) {
      router.push({
        pathname: "/shared/MapScreen",
        params: {
          selectionType: "route",
          rideId: "",
          startAddress: startAddress || "Departure point",
          endAddress: endAddress || "Destination",
          startLat: startLocation.latitude.toString(),
          startLng: startLocation.longitude.toString(),
          endLat: endLocation.latitude.toString(),
          endLng: endLocation.longitude.toString(),
        }
      });
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
      const newRide = await createRide(rideData);
      const preferences = {
        quiet_ride: quiet_ride ? 'yes' : 'no',
        radio_ok: radio_ok ? 'yes' : 'no',
        smoking_ok: smoking_ok ? 'yes' : 'no',
        pets_ok: pets_ok ? 'yes' : 'no',
        luggage_large: luggage_large ? 'yes' : 'no',
        female_driver_pref: female_driver_pref ? 'yes' : 'no',
      };
      await AsyncStorage.setItem('tripRequest', JSON.stringify({
        rideId: newRide.id,
        passengerId: newRide.passengerId || 1,
        preferences,
        startAddress: startAddress || "Departure point",
        endAddress: endAddress || "Destination",
      }));
      router.push({
        pathname: "/shared/MapScreen",
        params: {
          selectionType: "route",
          rideId: String(newRide.id),
          startAddress: startAddress || "Departure point",
          endAddress: endAddress || "Destination",
        }
      });
    } catch (error: any) {
      let errorMessage = 'Unable to create your request. Please try again.';
      if (error.response?.data?.message) errorMessage = error.response.data.message;
      else if (error.message) errorMessage = error.message;
      Alert.alert('Error', errorMessage);
    }
  };

  const isFormValid = () => startLocation && endLocation && dateDepart && !loadingStart && !loadingEnd && !rideLoading;

  // ── Whether to show saved places (only when query is empty) ──
  const hasSavedPlaces = savedAddresses.home || savedAddresses.work || savedAddresses.other || customPlaces.length > 0;
  const showSavedForStart = focusedField === 'start' && startQuery.length === 0 && hasSavedPlaces;
  const showSavedForEnd   = focusedField === 'destination' && endQuery.length === 0 && hasSavedPlaces;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Book a Ride</Text>

      {/* ── FROM FIELD ── */}
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
                <TouchableOpacity onPress={handleClearStart} style={styles.clearButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {focusedField === 'start' && (
          <View style={styles.optionsContainer}>

            {/* ── SAVED PLACES (shown only when search is empty) ── */}
            {showSavedForStart && (
              <SavedPlacesSection
                savedAddresses={savedAddresses}
                customPlaces={customPlaces}
                onSelect={handleSelectSavedForStart}
              />
            )}

            {/* ── DIVIDER between saved & options if saved visible ── */}
            {showSavedForStart && (
              <View style={{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 6 }} />
            )}

            {/* ── FIXED OPTIONS ── */}
            <TouchableOpacity style={styles.optionButton} onPress={handleCurrentPosition} activeOpacity={0.7}>
              <Ionicons name="location" size={20} color="#000" style={styles.optionIcon} />
              <Text style={styles.optionText}>Current position</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton} onPressIn={handleSetOnMapStart} activeOpacity={0.7}>
              <Ionicons name="map-outline" size={20} color="#000" style={styles.optionIcon} />
              <Text style={styles.optionText}>Set on map</Text>
            </TouchableOpacity>

            {/* ── AUTOCOMPLETE RESULTS ── */}
            {loadingStartSuggestions && <ActivityIndicator style={{ marginTop: 10 }} />}
            {startSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {startSuggestions.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.suggestionItem}
                    onPressIn={() => { isSelectingSuggestion.current = true; }}
                    onPress={() => handleSelectStartSuggestion(item)} activeOpacity={0.7}>
                    <Ionicons name="location-outline" size={18} color="#666" style={styles.suggestionIcon} />
                    <Text style={styles.suggestionTitle}>{item.displayName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── WHERE TO FIELD ── */}
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
                <TouchableOpacity onPress={handleClearEnd} style={styles.clearButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {focusedField === 'destination' && (
          <View style={styles.optionsContainer}>

            {/* ── SAVED PLACES ── */}
            {showSavedForEnd && (
              <SavedPlacesSection
                savedAddresses={savedAddresses}
                customPlaces={customPlaces}
                onSelect={handleSelectSavedForEnd}
              />
            )}

            {showSavedForEnd && (
              <View style={{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 6 }} />
            )}

            {/* ── FIXED OPTIONS ── */}
            <TouchableOpacity style={styles.optionButton} onPressIn={handleSetOnMapEnd} activeOpacity={0.7}>
              <Ionicons name="map-outline" size={20} color="#000" style={styles.optionIcon} />
              <Text style={styles.optionText}>Set on map</Text>
            </TouchableOpacity>

            {/* ── AUTOCOMPLETE RESULTS ── */}
            {loadingEndSuggestions && <ActivityIndicator style={{ marginTop: 10 }} />}
            {endSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {endSuggestions.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.suggestionItem}
                    onPressIn={() => { isSelectingSuggestion.current = true; }}
                    onPress={() => handleSelectEndSuggestion(item)} activeOpacity={0.7}>
                    <Ionicons name="location-outline" size={18} color="#666" style={styles.suggestionIcon} />
                    <Text style={styles.suggestionTitle}>{item.displayName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── DATE & TIME ── */}
      <TouchableOpacity style={styles.dateTimeButton} onPress={handleOpenDatePicker} activeOpacity={0.7}>
        <Ionicons name="calendar-outline" size={24} color="#6B46C1" />
        <Text style={[styles.dateTimeText, dateDepart && styles.dateTimeTextSelected]}>
          {formatDisplayDate()}
        </Text>
      </TouchableOpacity>

      {/* ── PREFERENCES ── */}
      <Text style={styles.sectionTitle}>Your Preferences</Text>
      {[
        { label: 'Quiet ride',            value: quiet_ride,        setter: setQuietRide },
        { label: 'Radio OK',              value: radio_ok,          setter: setRadioOk },
        { label: 'Smoking allowed',       value: smoking_ok,        setter: setSmokingOk },
        { label: 'Pets allowed',          value: pets_ok,           setter: setPetsOk },
        { label: 'Large luggage',         value: luggage_large,     setter: setLuggageLarge },
        { label: 'Female driver preferred', value: female_driver_pref, setter: setFemaleDriverPref },
      ].map(({ label, value, setter }) => (
        <View key={label} style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>{label}</Text>
          <Switch value={value} onValueChange={setter}
            trackColor={{ false: '#D1D5DB', true: '#000000' }}
            thumbColor={value ? '#FFFFFF' : '#F3F4F6'} />
        </View>
      ))}

      {/* ── DATE / TIME PICKERS ── */}
      {Platform.OS === 'ios' && showDatePicker && (
        <Modal transparent animationType="slide" visible={showDatePicker}>
          <View style={styles.modalOverlay}>
            <View style={styles.datePickerContainer}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => { setShowDatePicker(false); setShowTimePicker(false); }}>
                  <Text style={styles.cancelButton}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>{showTimePicker ? 'Time' : 'Select Date'}</Text>
                <TouchableOpacity onPress={() => { setShowDatePicker(false); setShowTimePicker(false); }}>
                  <Text style={styles.applyButton}>Apply</Text>
                </TouchableOpacity>
              </View>
              {!showTimePicker ? (
                <DateTimePicker value={selectedDate} mode="date" display="inline"
                  onChange={handleDateChange} minimumDate={new Date()} textColor="#000" />
              ) : (
                <DateTimePicker value={selectedDate} mode="time" display="spinner"
                  onChange={handleTimeChange} textColor="#000" />
              )}
              {!showTimePicker && (
                <TouchableOpacity style={styles.nextButton} onPress={() => setShowTimePicker(true)}>
                  <Text style={styles.nextButtonText}>Next: Select Time</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      )}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker value={selectedDate} mode="date" display="default"
          onChange={handleDateChange} minimumDate={new Date()} />
      )}
      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker value={selectedDate} mode="time" display="default" onChange={handleTimeChange} />
      )}

      {/* ── SUBMIT ── */}
      <TouchableOpacity
        style={[styles.rideRequestButton, !isFormValid() && styles.disabled]}
        disabled={!isFormValid()}
        onPress={handleRideRequest}
        activeOpacity={0.8}
      >
        {rideLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={styles.rideRequestContent}>
            <Ionicons name="car" size={22} color="#fff" />
            <Text style={styles.rideRequestText}>Ride Request</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 24, color: "#000" },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#000", marginTop: 24, marginBottom: 16 },
  fieldContainer: { marginBottom: 16 },
  inputContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: "#F5F5F5", 
    padding: 16, 
    borderRadius: 12, 
    minHeight: 56,
  },
  input: { flex: 1, fontSize: 16, color: "#000" },
  clearButton: { marginLeft: 8 },
  loadingRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { fontSize: 16, color: "#666", fontStyle: "italic" },
  optionsContainer: { marginTop: 8, backgroundColor: "#FAFAFA", borderRadius: 12, padding: 8 },
  optionButton: {
    flexDirection: "row", 
    alignItems: "center",
    padding: 12, 
    backgroundColor: "#FFF", 
    borderRadius: 8, 
    marginBottom: 6,
  },
  optionIcon: { marginRight: 12 },
  optionText: { fontSize: 15, color: "#000", fontWeight: "500" },
  suggestionsContainer: { marginTop: 8 },
  suggestionItem: {
    flexDirection: "row", 
    alignItems: "center",
    padding: 12, 
    backgroundColor: "#FFF", 
    borderRadius: 8, 
    marginBottom: 6,
  },
  suggestionIcon: { marginRight: 12 },
  suggestionTitle: { fontSize: 15, fontWeight: "600", color: "#000" },
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
  dateTimeText: { fontSize: 16, color: '#999', marginLeft: 12, flex: 1 },
  dateTimeTextSelected: { color: '#000', fontWeight: '500' },
  preferenceRow: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    backgroundColor: '#F5F5F5', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12,
  },
  preferenceLabel: { fontSize: 15, fontWeight: '500', color: '#000' },
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
  pickerTitle: { fontSize: 18, fontWeight: '600', color: '#000' },
  cancelButton: { fontSize: 16, color: '#6B46C1' },
  applyButton: { fontSize: 16, color: '#6B46C1', fontWeight: '600' },
  nextButton: {
    backgroundColor: '#6B46C1', 
    padding: 16,
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 16,
  },
  nextButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  rideRequestButton: {
    backgroundColor: "#000",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  rideRequestContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rideRequestText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  disabled: { backgroundColor: "#CCC", opacity: 0.6 },
  // ── Saved places ──
  savedSection:      { marginBottom: 4 },
  savedSectionTitle: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, paddingHorizontal: 4 },

  chipsRow: { marginBottom: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0F0F0', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: '#111', maxWidth: 90 },

  savedRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    marginBottom: 6,
  },
  savedRowIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  savedRowLabel:   { fontSize: 14, fontWeight: '700', color: '#111' },
  savedRowAddress: { fontSize: 12, color: '#888', marginTop: 1 },
});