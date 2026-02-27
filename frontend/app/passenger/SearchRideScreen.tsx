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
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationContext } from "../../context/LocationContext";
import { useRide } from "../../context/RideContext";
import { reverseGeocode } from "../../utils/reverseGeocode";
import { searchPlaces } from "../../services/placesService";
import { validateLocationsInAlgeria } from "../../utils/Geovalidation";
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../services/api';

type SavedAddress = { name: string; address: string; lat?: number; lng?: number } | null;
type SavedAddresses = { home: SavedAddress; work: SavedAddress; other: SavedAddress };
type CustomPlace = { id: string; name: string; address: string; lat?: number; lng?: number };

function SavedChip({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.chip} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon as any} size={14} color="#111" style={{ marginRight: 5 }} />
      <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function SavedPlacesSection({
  savedAddresses, customPlaces, onSelect,
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ paddingRight: 8 }}>
        {all.map(p => (
          <SavedChip key={p.id} icon={p.icon} label={p.label}
            onPress={() => onSelect({ address: p.address, lat: p.lat, lng: p.lng })} />
        ))}
      </ScrollView>
      {all.map(p => (
        <TouchableOpacity key={p.id} style={styles.savedRow}
          onPress={() => onSelect({ address: p.address, lat: p.lat, lng: p.lng })} activeOpacity={0.7}>
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

  useEffect(() => {
    const loadSavedAddresses = async () => {
      try {
        const res = await api.get('/passengers/saved-places');
        const places = res.data.data || [];
        const home  = places.find((p: any) => p.label.toLowerCase() === 'home')  || null;
        const work  = places.find((p: any) => p.label.toLowerCase() === 'work')  || null;
        const other = places.find((p: any) => p.label.toLowerCase() === 'other') || null;
        setSavedAddresses({
          home:  home  ? { name: 'Home',  address: home.address,  lat: home.lat,  lng: home.lng }  : null,
          work:  work  ? { name: 'Work',  address: work.address,  lat: work.lat,  lng: work.lng }  : null,
          other: other ? { name: 'Other', address: other.address, lat: other.lat, lng: other.lng } : null,
        });
        const custom = places.filter((p: any) => !['home','work','other'].includes(p.label.toLowerCase()));
        setCustomPlaces(custom.map((p: any) => ({ id: String(p.id), name: p.label, address: p.address, lat: p.lat, lng: p.lng })));
      } catch (e) {
        console.error('Failed to load saved addresses:', e);
      }
    };
    loadSavedAddresses();
  }, []);

  useEffect(() => {
    return () => { if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current); };
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!startLocation?.latitude || !startLocation?.longitude) {
        setStartAddress(""); setLoadingStart(false); lastStartCoords.current = null; return;
      }
      const key = `${startLocation.latitude.toFixed(4)},${startLocation.longitude.toFixed(4)}`;
      if (lastStartCoords.current === key) return;
      lastStartCoords.current = key;
      setLoadingStart(true);
      try {
        await new Promise(r => setTimeout(r, 150));
        setStartAddress(await reverseGeocode(startLocation));
        setStartQuery("");
      } catch { setStartAddress("Error loading address"); }
      finally { setLoadingStart(false); }
    };
    load();
  }, [startLocation?.latitude, startLocation?.longitude]);

  useEffect(() => {
    const load = async () => {
      if (!endLocation?.latitude || !endLocation?.longitude) {
        setEndAddress(""); setLoadingEnd(false); lastEndCoords.current = null; return;
      }
      const key = `${endLocation.latitude.toFixed(4)},${endLocation.longitude.toFixed(4)}`;
      if (lastEndCoords.current === key) return;
      lastEndCoords.current = key;
      setLoadingEnd(true);
      try {
        await new Promise(r => setTimeout(r, 500));
        setEndAddress(await reverseGeocode(endLocation));
        setEndQuery("");
      } catch { setEndAddress("Error loading address"); }
      finally { setLoadingEnd(false); }
    };
    load();
  }, [endLocation?.latitude, endLocation?.longitude]);

  useEffect(() => {
    const fetch = async () => {
      if (startQuery.length < 2) { setStartSuggestions([]); return; }
      setLoadingStartSuggestions(true);
      try { setStartSuggestions(await searchPlaces(startQuery, currentLocation)); }
      catch (e) { console.error(e); }
      finally { setLoadingStartSuggestions(false); }
    };
    const t = setTimeout(fetch, 500); return () => clearTimeout(t);
  }, [startQuery]);

  useEffect(() => {
    const fetch = async () => {
      if (endQuery.length < 2) { setEndSuggestions([]); return; }
      setLoadingEndSuggestions(true);
      try { setEndSuggestions(await searchPlaces(endQuery, currentLocation)); }
      catch (e) { console.error(e); }
      finally { setLoadingEndSuggestions(false); }
    };
    const t = setTimeout(fetch, 500); return () => clearTimeout(t);
  }, [endQuery]);

  const handleStartFocus = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setFocusedField('start'); setStartQuery(startAddress);
  };
  const handleEndFocus = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setFocusedField('destination'); setEndQuery(endAddress);
  };
  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      if (!isSelectingSuggestion.current && !isNavigatingToMap.current) setFocusedField(null);
    }, 400);
  };

  const handleClearStart = () => {
    setStartLocation(null); setStartAddress(""); setStartQuery(""); setStartSuggestions([]);
    lastStartCoords.current = null; setFocusedField('start'); startInputRef.current?.focus();
  };
  const handleClearEnd = () => {
    setEndLocation(null); setEndAddress(""); setEndQuery(""); setEndSuggestions([]);
    lastEndCoords.current = null; setFocusedField('destination'); endInputRef.current?.focus();
  };

  const handleCurrentPosition = async () => {
    if (currentLocation) { setStartLocation(currentLocation); setFocusedField(null); Keyboard.dismiss(); }
  };

  const handleSetOnMapStart = () => {
    isNavigatingToMap.current = true;
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setFocusedField(null); Keyboard.dismiss();
    setTimeout(() => {
      isNavigatingToMap.current = false;
      router.push({ pathname: "/shared/MapScreen", params: { selectionType: "start" } });
    }, 50);
  };
  const handleSetOnMapEnd = () => {
    isNavigatingToMap.current = true;
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setFocusedField(null); Keyboard.dismiss();
    setTimeout(() => {
      isNavigatingToMap.current = false;
      router.push({ pathname: "/shared/MapScreen", params: { selectionType: "destination" } });
    }, 50);
  };

  const handleSelectStartSuggestion = (place: any) => {
    isSelectingSuggestion.current = false;
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setStartLocation({ latitude: place.latitude, longitude: place.longitude });
    setStartSuggestions([]); setFocusedField(null); Keyboard.dismiss();
  };
  const handleSelectEndSuggestion = (place: any) => {
    isSelectingSuggestion.current = false;
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setEndLocation({ latitude: place.latitude, longitude: place.longitude });
    setEndSuggestions([]); setFocusedField(null); Keyboard.dismiss();
  };

  const handleSelectSavedForStart = (place: { address: string; lat?: number; lng?: number }) => {
    isSelectingSuggestion.current = false;
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    if (place.lat && place.lng) setStartLocation({ latitude: place.lat, longitude: place.lng });
    else setStartAddress(place.address);
    setStartSuggestions([]); setFocusedField(null); Keyboard.dismiss();
  };
  const handleSelectSavedForEnd = (place: { address: string; lat?: number; lng?: number }) => {
    isSelectingSuggestion.current = false;
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    if (place.lat && place.lng) setEndLocation({ latitude: place.lat, longitude: place.lng });
    else setEndAddress(place.address);
    setEndSuggestions([]); setFocusedField(null); Keyboard.dismiss();
  };

  const handleOpenDatePicker = () => setShowDatePicker(true);
  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) { setSelectedDate(date); if (Platform.OS === 'android') setTimeout(() => setShowTimePicker(true), 100); }
  };
  const handleTimeChange = (event: any, time?: Date) => {
    setShowTimePicker(false);
    if (time) {
      const dt = new Date(selectedDate);
      dt.setHours(time.getHours()); dt.setMinutes(time.getMinutes());
      setDateDepart(dt);
      setHeureDepart(`${time.getHours().toString().padStart(2,'0')}:${time.getMinutes().toString().padStart(2,'0')}`);
      if (Platform.OS === 'ios') setShowDatePicker(false);
    }
  };

  const handleRideRequest = async () => {
    if (!startLocation || !endLocation || !dateDepart) { Alert.alert('Error', 'Please fill all fields'); return; }
    const validation = validateLocationsInAlgeria(startLocation, endLocation);
    if (!validation.valid) {
      router.push({ pathname: "/shared/MapScreen", params: { selectionType: "route", rideId: "", startAddress: startAddress || "Departure point", endAddress: endAddress || "Destination", startLat: startLocation.latitude.toString(), startLng: startLocation.longitude.toString(), endLat: endLocation.latitude.toString(), endLng: endLocation.longitude.toString() } });
      return;
    }
    try {
      const newRide = await createRide({
        startLat: startLocation.latitude, startLng: startLocation.longitude,
        startAddress: startAddress || "Departure point",
        endLat: endLocation.latitude, endLng: endLocation.longitude,
        endAddress: endAddress || "Destination",
        departureTime: dateDepart.toISOString(),
      });
      await AsyncStorage.setItem('tripRequest', JSON.stringify({
        rideId: newRide.id, passengerId: newRide.passengerId || 1,
        preferences: { quiet_ride: quiet_ride?'yes':'no', radio_ok: radio_ok?'yes':'no', smoking_ok: smoking_ok?'yes':'no', pets_ok: pets_ok?'yes':'no', luggage_large: luggage_large?'yes':'no', female_driver_pref: female_driver_pref?'yes':'no' },
        startAddress: startAddress || "Departure point", endAddress: endAddress || "Destination",
      }));
      router.push({ pathname: "/shared/MapScreen", params: { selectionType: "route", rideId: String(newRide.id), startAddress: startAddress || "Departure point", endAddress: endAddress || "Destination" } });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || error.message || 'Unable to create your request.');
    }
  };

  const isFormValid = () => !!(startLocation && endLocation && dateDepart && !loadingStart && !loadingEnd && !rideLoading);

  const hasSavedPlaces = savedAddresses.home || savedAddresses.work || savedAddresses.other || customPlaces.length > 0;
  const showSavedForStart = focusedField === 'start' && startQuery.length === 0 && hasSavedPlaces;
  const showSavedForEnd   = focusedField === 'destination' && endQuery.length === 0 && hasSavedPlaces;

  const preferences = [
    { label: 'Quiet ride',    icon: 'ear-hearing-off', value: quiet_ride,         setter: setQuietRide },
    { label: 'Radio OK',      icon: 'radio',           value: radio_ok,           setter: setRadioOk },
    { label: 'Smoking',       icon: 'smoking',         value: smoking_ok,         setter: setSmokingOk },
    { label: 'Pets OK',       icon: 'paw',             value: pets_ok,            setter: setPetsOk },
    { label: 'Large bags',    icon: 'bag-suitcase',    value: luggage_large,      setter: setLuggageLarge },
    { label: 'Female driver', icon: 'gender-female',   value: female_driver_pref, setter: setFemaleDriverPref },
  ];

  const valid = isFormValid();

  return (
    <>
      {/* ── Custom header ── */}
      <Stack.Screen options={{
        title: '',
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 4 }}>
            <Ionicons name="arrow-back" size={24} color="#111" />
          </TouchableOpacity>
        ),
        headerTitle: () => (
          <Text style={styles.headerTitle}>Book a Ride</Text>
        ),
        headerRight: () => (
          <TouchableOpacity onPress={handleOpenDatePicker} style={styles.calendarBtn} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={17} color={dateDepart ? "#111" : "#888"} />
            {dateDepart ? (
              <Text style={styles.calendarDateText}>
                {dateDepart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {heureDepart}
              </Text>
            ) : (
              <Text style={styles.calendarPlaceholder}>Pick date</Text>
            )}
          </TouchableOpacity>
        ),
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#fff' },
      }} />

      {/* ── OUTER WRAPPER — column: scroll content + sticky bottom ── */}
      <View style={styles.outerWrapper}>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            style={styles.container}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {/* ── FROM / TO FIELDS ── */}
            <View style={styles.routeCard}>
              {/* FROM */}
              <View style={styles.routeRow}>
                <View style={styles.dotGreen} />
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
                        <TouchableOpacity onPress={handleClearStart} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                          <Ionicons name="close-circle" size={20} color="#999" />
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </View>

              <View style={styles.routeDivider} />

              {/* TO */}
              <View style={styles.routeRow}>
                <View style={styles.dotBlue} />
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
                        <TouchableOpacity onPress={handleClearEnd} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                          <Ionicons name="close-circle" size={20} color="#999" />
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </View>
            </View>

            {/* ── FROM DROPDOWN ── */}
            {focusedField === 'start' && (
              <View style={styles.optionsContainer}>
                {showSavedForStart && (
                  <>
                    <SavedPlacesSection savedAddresses={savedAddresses} customPlaces={customPlaces} onSelect={handleSelectSavedForStart} />
                    <View style={styles.dividerLine} />
                  </>
                )}
                <TouchableOpacity style={styles.optionButton} onPress={handleCurrentPosition} activeOpacity={0.7}>
                  <View style={styles.optionIconWrap}>
                    <Ionicons name="locate" size={18} color="#fff" />
                  </View>
                  <Text style={styles.optionText}>Current position</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.optionButton}
                  onPressIn={() => { isSelectingSuggestion.current = true; }}
                  onPress={handleSetOnMapStart}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIconWrap, { backgroundColor: '#3B82F6' }]}>
                    <Ionicons name="map-outline" size={18} color="#fff" />
                  </View>
                  <Text style={styles.optionText}>Set location on map</Text>
                </TouchableOpacity>
                {loadingStartSuggestions && <ActivityIndicator style={{ marginTop: 8 }} />}
                {startSuggestions.length > 0 && (
                  <>
                    <View style={styles.dividerLine} />
                    {startSuggestions.map((item) => (
                      <TouchableOpacity key={item.id} style={styles.suggestionItem}
                        onPressIn={() => { isSelectingSuggestion.current = true; }}
                        onPress={() => handleSelectStartSuggestion(item)} activeOpacity={0.7}>
                        <Ionicons name="location-outline" size={18} color="#666" style={styles.optionIcon} />
                        <Text style={styles.suggestionTitle}>{item.displayName}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* ── TO DROPDOWN ── */}
            {focusedField === 'destination' && (
              <View style={styles.optionsContainer}>
                {showSavedForEnd && (
                  <>
                    <SavedPlacesSection savedAddresses={savedAddresses} customPlaces={customPlaces} onSelect={handleSelectSavedForEnd} />
                    <View style={styles.dividerLine} />
                  </>
                )}
                <TouchableOpacity
                  style={styles.optionButton}
                  onPressIn={() => { isSelectingSuggestion.current = true; }}
                  onPress={handleSetOnMapEnd}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIconWrap, { backgroundColor: '#3B82F6' }]}>
                    <Ionicons name="map-outline" size={18} color="#fff" />
                  </View>
                  <Text style={styles.optionText}>Set location on map</Text>
                </TouchableOpacity>
                {loadingEndSuggestions && <ActivityIndicator style={{ marginTop: 8 }} />}
                {endSuggestions.length > 0 && (
                  <>
                    <View style={styles.dividerLine} />
                    {endSuggestions.map((item) => (
                      <TouchableOpacity key={item.id} style={styles.suggestionItem}
                        onPressIn={() => { isSelectingSuggestion.current = true; }}
                        onPress={() => handleSelectEndSuggestion(item)} activeOpacity={0.7}>
                        <Ionicons name="location-outline" size={18} color="#666" style={styles.optionIcon} />
                        <Text style={styles.suggestionTitle}>{item.displayName}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* ── PREFERENCES ── */}
            <Text style={styles.sectionTitle}>Your Preferences</Text>
            <View style={styles.prefsGrid}>
              {preferences.map(({ label, icon, value, setter }) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.prefChip, value && styles.prefChipActive]}
                  onPress={() => setter(!value)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name={icon as any} size={18} color={value ? '#fff' : '#555'} />
                  <Text style={[styles.prefChipText, value && styles.prefChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── CONTINUE — always-visible, pill bar matching preference chip style ── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.continueChip, !valid && styles.continueChipDisabled]}
            disabled={!valid}
            onPress={handleRideRequest}
            activeOpacity={0.8}
          >
            {rideLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="arrow-right-circle-outline"
                  size={22}
                  color={valid ? '#fff' : '#bbb'}
                />
                <Text style={[styles.continueText, !valid && styles.continueTextDisabled]}>
                  Continue
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

      </View>

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
                <DateTimePicker value={selectedDate} mode="date" display="inline" onChange={handleDateChange} minimumDate={new Date()} textColor="#000" />
              ) : (
                <DateTimePicker value={selectedDate} mode="time" display="spinner" onChange={handleTimeChange} textColor="#000" />
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
        <DateTimePicker value={selectedDate} mode="date" display="default" onChange={handleDateChange} minimumDate={new Date()} />
      )}
      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker value={selectedDate} mode="time" display="default" onChange={handleTimeChange} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // ── Layout ──
  outerWrapper: { flex: 1, backgroundColor: '#fff', flexDirection: 'column' },
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },

  // ── Header ──
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111' },
  calendarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F5F5F5', borderRadius: 20,
    paddingHorizontal: 11, paddingVertical: 6,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  calendarDateText: { fontSize: 11, fontWeight: '700', color: '#111' },
  calendarPlaceholder: { fontSize: 11, fontWeight: '500', color: '#999' },

  // ── Route card ──
  routeCard: {
    backgroundColor: '#F7F7F7', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 8, marginBottom: 8,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  routeDivider: { height: 1, backgroundColor: '#E5E5E5', marginLeft: 24 },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E' },
  dotBlue:  { width: 12, height: 12, borderRadius: 6, backgroundColor: '#3B82F6' },

  // ── Input ──
  inputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 15, color: '#000' },
  loadingRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 15, color: '#666', fontStyle: 'italic' },

  // ── Dropdown ──
  optionsContainer: {
    backgroundColor: '#FAFAFA', borderRadius: 12, padding: 8, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  dividerLine: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 6 },
  optionButton: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, backgroundColor: '#FFF',
    borderRadius: 10, marginBottom: 6, gap: 12,
  },
  optionIconWrap: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
  },
  optionIcon: { marginRight: 12 },
  optionText: { fontSize: 15, color: '#000', fontWeight: '500' },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, backgroundColor: '#FFF', borderRadius: 10, marginBottom: 6,
  },
  suggestionTitle: { fontSize: 15, fontWeight: '600', color: '#000' },

  // ── Section title ──
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginTop: 20, marginBottom: 12 },

  // ── Preference chips ──
  prefsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  prefChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F5F5F5', borderRadius: 50,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  prefChipActive: { backgroundColor: '#111', borderColor: '#111' },
  prefChipText: { fontSize: 13, fontWeight: '600', color: '#555' },
  prefChipTextActive: { color: '#fff' },

  // ── Bottom bar — always visible ──
  bottomBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 10, shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },

  // ── Continue chip — full-width pill, same DNA as prefChip ──
  continueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#111',
    borderRadius: 50,          // pill = same as prefChip
    paddingVertical: 15,
    borderWidth: 1.5,
    borderColor: '#111',
  },
  continueChipDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E7EB',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  continueTextDisabled: { color: '#bbb' },

  // ── Saved places ──
  savedSection: { marginBottom: 4 },
  savedSectionTitle: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, paddingHorizontal: 4 },
  chipsRow: { marginBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#111', maxWidth: 90 },
  savedRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 6 },
  savedRowIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  savedRowLabel: { fontSize: 14, fontWeight: '700', color: '#111' },
  savedRowAddress: { fontSize: 12, color: '#888', marginTop: 1 },

  // ── Date picker modal ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  datePickerContainer: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, width: '85%', maxWidth: 400 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  pickerTitle: { fontSize: 18, fontWeight: '600', color: '#000' },
  cancelButton: { fontSize: 16, color: '#6B46C1' },
  applyButton: { fontSize: 16, color: '#6B46C1', fontWeight: '600' },
  nextButton: { backgroundColor: '#6B46C1', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  nextButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});