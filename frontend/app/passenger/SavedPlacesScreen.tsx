import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Animated,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const STORAGE_KEY = 'saved_addresses';

const ADDRESS_TYPES = [
  { key: 'home',  label: 'Home',  icon: 'home-outline',     filledIcon: 'home' },
  { key: 'work',  label: 'Work',  icon: 'briefcase-outline', filledIcon: 'briefcase' },
  { key: 'other', label: 'Other', icon: 'location-outline',  filledIcon: 'location' },
];

// ─────────────────────────────────────────────
// MOCK GEOCODER  (replace with real API / expo-location)
// ─────────────────────────────────────────────
async function searchPlaces(query) {
  // Simulates an API call – swap with your real geocoding service
  await new Promise(r => setTimeout(r, 600));
  if (!query.trim()) return [];
  return [
    { id: '1', name: query,            address: `${query}, Alger, Algérie` },
    { id: '2', name: `${query} Center`, address: `${query} Center, Bir Mourad Raïs, Alger` },
    { id: '3', name: `${query} Nord`,   address: `${query} Nord, Bab Ezzouar, Alger` },
    { id: '4', name: `Rue ${query}`,    address: `Rue ${query}, Hussein Dey, Alger` },
  ];
}

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function SavedPlacesScreen() {
  const [addresses, setAddresses]   = useState({ home: null, work: null, other: null });
  const [customPlaces, setCustom]   = useState([]);   // extra "Add a new address" entries
  const [loading, setLoading]       = useState(true);
  const [modalVisible, setModal]    = useState(false);
  const [editTarget, setEditTarget] = useState(null); // { key, label, icon }
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Load from storage ──────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setAddresses(saved.addresses || { home: null, work: null, other: null });
          setCustom(saved.custom || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }
    })();
  }, []);

  // ── Persist ────────────────────────────────
  const persist = async (newAddresses, newCustom) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ addresses: newAddresses, custom: newCustom }));
    } catch (e) { console.error(e); }
  };

  // ── Save address (home/work/other) ─────────
  const saveAddress = (key, place) => {
    const updated = { ...addresses, [key]: place };
    setAddresses(updated);
    persist(updated, customPlaces);
    setModal(false);
  };

  // ── Save custom address ────────────────────
  const saveCustomAddress = (place) => {
    const updated = [...customPlaces, { ...place, id: Date.now().toString() }];
    setCustom(updated);
    persist(addresses, updated);
    setModal(false);
  };

  // ── Delete address ─────────────────────────
  const deleteAddress = (key) => {
    Alert.alert('Remove address', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => {
          if (key === 'custom_all') {
            setCustom([]);
            persist(addresses, []);
          } else if (key.startsWith('custom_')) {
            const id = key.replace('custom_', '');
            const updated = customPlaces.filter(p => p.id !== id);
            setCustom(updated);
            persist(addresses, updated);
          } else {
            const updated = { ...addresses, [key]: null };
            setAddresses(updated);
            persist(updated, customPlaces);
          }
        },
      },
    ]);
  };

  // ── Open modal ─────────────────────────────
  const openModal = (target) => {
    setEditTarget(target);
    setModal(true);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Addresses',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: '#fff' },
          headerShadowVisible: false,
        }}
      />

      <Animated.ScrollView
        style={{ flex: 1, backgroundColor: '#fff', opacity: fadeAnim }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── ILLUSTRATION + HEADER ── */}
        <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 20 }}>
          {/* Simple SVG-like map illustration using Views */}
          <MapIllustration />
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#111', marginTop: 16 }}>
            Saved addresses
          </Text>
          <Text style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
            Easily access your favorite locations.
          </Text>
        </View>

        {/* ── DIVIDER ── */}
        <View style={{ height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 20, marginBottom: 8 }} />

        {/* ── HOME / WORK / OTHER ── */}
        {ADDRESS_TYPES.map(type => (
          <AddressRow
            key={type.key}
            icon={addresses[type.key] ? type.filledIcon : type.icon}
            label={type.label}
            value={addresses[type.key]?.address || null}
            placeholder="Tap to set the address"
            onPress={() => openModal({ key: type.key, label: type.label, icon: type.filledIcon })}
            onDelete={addresses[type.key] ? () => deleteAddress(type.key) : null}
          />
        ))}

        {/* ── CUSTOM PLACES ── */}
        {customPlaces.map(place => (
          <AddressRow
            key={place.id}
            icon="bookmark-outline"
            label={place.name}
            value={place.address}
            placeholder=""
            onPress={() => openModal({ key: `custom_${place.id}`, label: place.name, icon: 'bookmark' })}
            onDelete={() => deleteAddress(`custom_${place.id}`)}
          />
        ))}

        {/* ── ADD NEW ── */}
        <TouchableOpacity
          onPress={() => openModal({ key: 'new', label: 'New place', icon: 'add-circle-outline' })}
          style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 24, paddingVertical: 18,
          }}
          activeOpacity={0.7}
        >
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: '#F5F5F5',
            alignItems: 'center', justifyContent: 'center',
            marginRight: 16,
          }}>
            <Ionicons name="add" size={22} color="#111" />
          </View>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>Add a new address</Text>
        </TouchableOpacity>
      </Animated.ScrollView>

      {/* ── ADDRESS PICKER MODAL ── */}
      <AddressModal
        visible={modalVisible}
        target={editTarget}
        onClose={() => setModal(false)}
        onSave={(place) => {
          if (!editTarget) return;
          if (editTarget.key === 'new') {
            saveCustomAddress(place);
          } else {
            saveAddress(editTarget.key.replace('custom_', ''), place);
          }
        }}
      />
    </>
  );
}

// ─────────────────────────────────────────────
// ADDRESS ROW
// ─────────────────────────────────────────────
function AddressRow({ icon, label, value, placeholder, onPress, onDelete }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
      }}
    >
      {/* Icon circle */}
      <View style={{
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: value ? '#111' : '#F5F5F5',
        alignItems: 'center', justifyContent: 'center',
        marginRight: 16,
      }}>
        <Ionicons name={icon} size={19} color={value ? '#fff' : '#555'} />
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111' }}>{label}</Text>
        {value ? (
          <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }} numberOfLines={1}>{value}</Text>
        ) : (
          <Text style={{ fontSize: 13, color: '#BBB', marginTop: 2 }}>{placeholder}</Text>
        )}
      </View>

      {/* Delete / chevron */}
      {onDelete ? (
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ellipsis-vertical" size={18} color="#BBB" />
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-forward" size={16} color="#CCC" />
      )}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// ADDRESS MODAL  (search + set on map)
// ─────────────────────────────────────────────
function AddressModal({ visible, target, onClose, onSave }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearch]  = useState(false);
  const debounceRef             = useRef(null);

  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]); }
  }, [visible]);

  const handleType = (text) => {
    setQuery(text);
    clearTimeout(debounceRef.current);
    if (!text.trim()) { setResults([]); return; }
    setSearch(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchPlaces(text);
      setResults(res);
      setSearch(false);
    }, 500);
  };

  const handleSelect = (place) => {
    onSave({ name: target?.label || place.name, address: place.address });
  };

  const handleSetOnMap = () => {
    onClose();
    Alert.alert('Coming Soon', 'Map picker will be available soon.');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>

          {/* ── HEADER ── */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12,
            borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
          }}>
            <TouchableOpacity onPress={onClose} style={{ padding: 6, marginRight: 8 }}>
              <Ionicons name="arrow-back" size={22} color="#111" />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#111', flex: 1 }}>
              {target?.label ? `Set ${target.label}` : 'Add address'}
            </Text>
          </View>

          {/* ── SEARCH BAR ── */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            margin: 16, backgroundColor: '#F5F5F5',
            borderRadius: 14, paddingHorizontal: 14, height: 48,
          }}>
            <Ionicons name="search-outline" size={18} color="#999" />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#111' }}
              placeholder="Search for a place..."
              placeholderTextColor="#BBB"
              value={query}
              onChangeText={handleType}
              autoFocus
              returnKeyType="search"
            />
            {searching && <ActivityIndicator size="small" color="#999" />}
            {query.length > 0 && !searching && (
              <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
                <Ionicons name="close-circle" size={18} color="#BBB" />
              </TouchableOpacity>
            )}
          </View>

          {/* ── RESULTS ── */}
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F5F5F5', marginLeft: 60 }} />}
            ListEmptyComponent={
              !searching && query.length > 0 ? (
                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                  <Ionicons name="search-outline" size={36} color="#DDD" />
                  <Text style={{ color: '#BBB', marginTop: 10, fontSize: 14 }}>No results found</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 20, paddingVertical: 14,
                }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: '#F0F0F0',
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 14,
                }}>
                  <Ionicons name="location-outline" size={17} color="#555" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111' }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }} numberOfLines={1}>{item.address}</Text>
                </View>
              </TouchableOpacity>
            )}
          />

          {/* ── SET ON MAP ── */}
          <TouchableOpacity
            onPress={handleSetOnMap}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 20, paddingVertical: 18,
              borderTopWidth: 1, borderTopColor: '#F0F0F0',
            }}
          >
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: '#111',
              alignItems: 'center', justifyContent: 'center',
              marginRight: 14,
            }}>
              <Ionicons name="map-outline" size={17} color="#fff" />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#111' }}>Set location on map</Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// MAP ILLUSTRATION  (pure View-based)
// ─────────────────────────────────────────────
function MapIllustration() {
  return (
    <View style={{ width: 140, height: 120, alignItems: 'center', justifyContent: 'center' }}>
      {/* Map base */}
      <View style={{
        width: 120, height: 80,
        backgroundColor: '#EDE9FE',
        borderRadius: 12,
        transform: [{ rotateX: '20deg' }, { rotateZ: '-5deg' }],
        shadowColor: '#7C3AED', shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
        alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {/* Grid lines */}
        <View style={{ position: 'absolute', top: '33%', left: 0, right: 0, height: 1, backgroundColor: '#C4B5FD' }} />
        <View style={{ position: 'absolute', top: '66%', left: 0, right: 0, height: 1, backgroundColor: '#C4B5FD' }} />
        <View style={{ position: 'absolute', left: '33%', top: 0, bottom: 0, width: 1, backgroundColor: '#C4B5FD' }} />
        <View style={{ position: 'absolute', left: '66%', top: 0, bottom: 0, width: 1, backgroundColor: '#C4B5FD' }} />
      </View>
      {/* Pin */}
      <View style={{
        position: 'absolute', top: 10,
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: '#164dcd',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#164dcd', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
      }}>
        <Ionicons name="location" size={20} color="#fff" />
      </View>
      {/* Dots */}
      {[
        { top: 20, left: 10, color: '#F97316', size: 10 },
        { top: 55, left: 15, color: '#F97316', size: 8 },
        { top: 35, right: 12, color: '#5b88c6', size: 10 },
        { top: 65, right: 20, color: '#5b88c6', size: 7 },
      ].map((dot, i) => (
        <View key={i} style={{
          position: 'absolute',
          width: dot.size, height: dot.size, borderRadius: dot.size / 2,
          backgroundColor: dot.color,
          top: dot.top, left: dot.left, right: dot.right,
        }} />
      ))}
    </View>
  );
}