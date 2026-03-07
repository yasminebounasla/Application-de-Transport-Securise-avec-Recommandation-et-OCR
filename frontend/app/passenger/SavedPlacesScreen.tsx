import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
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
import { Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { searchPlaces } from '../../services/placesService';

// Only Home and Work as fixed types
const ADDRESS_TYPES = [
  { key: 'home', label: 'Home', icon: 'home-outline',     filledIcon: 'home' },
  { key: 'work', label: 'Work', icon: 'briefcase-outline', filledIcon: 'briefcase' },
];

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function SavedPlacesScreen() {
  const [places, setPlaces]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalVisible, setModal]    = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  // Nickname first, then address (for "Add new place" flow)
  const [nicknameModal, setNicknameModal]   = useState(false);
  const [pendingPlace, setPendingPlace]     = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [nickname, setNickname]             = useState('');
  const [pendingNickname, setPendingNickname] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Load from API ──────────────────────────
  const loadPlaces = async () => {
    try {
      const res = await api.get('/passengers/saved-places');
      setPlaces(res.data.data || []);
    } catch (e) {
      console.error('loadPlaces:', e.message);
      Alert.alert('Error', 'Failed to load saved places.');
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  };

  useFocusEffect(useCallback(() => { loadPlaces(); }, []));

  const findByLabel = (label) =>
    places.find(p => p.label.toLowerCase() === label.toLowerCase()) || null;

  // ── ADD ───────────────────────────────────
  const addPlace = async ({ label, address, lat, lng }) => {
    try {
      const res = await api.post('/passengers/saved-places', { label, address, lat, lng });
      setPlaces(prev => [res.data.data, ...prev]);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || e.message);
    }
  };

  // ── UPDATE ────────────────────────────────
  const updatePlace = async (id, payload) => {
    try {
      const res = await api.put(`/passengers/saved-places/${id}`, payload);
      setPlaces(prev => prev.map(p => (p.id === id ? res.data.data : p)));
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || e.message);
    }
  };

  // ── DELETE ────────────────────────────────
  const deletePlace = (id) => {
    Alert.alert('Remove address', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/passengers/saved-places/${id}`);
            setPlaces(prev => prev.filter(p => p.id !== id));
          } catch (e) {
            Alert.alert('Error', e.response?.data?.message || e.message);
          }
        },
      },
    ]);
  };

  // ── Save from modal (Home / Work) ─────────
  const handleSave = async ({ label, address, lat, lng }) => {
    if (!editTarget) return;
    setModal(false);
    const existing = findByLabel(editTarget.label);
    if (existing) {
      await updatePlace(existing.id, { label: editTarget.label, address, lat, lng });
    } else {
      await addPlace({ label: editTarget.label, address, lat, lng });
    }
  };

  // ── New place flow ────────────────────────
  // Step 1: click "Add new" → show nickname modal
  const handleOpenNewPlace = () => {
    setNickname('');
    setNicknameModal(true);
  };

  // Step 2: nickname confirmed → open address search with that label
  const handleNicknameConfirmed = () => {
    if (!nickname.trim()) return;
    setPendingNickname(nickname.trim());
    setNicknameModal(false);
    setTimeout(() => {
      setEditTarget({ key: 'new', label: nickname.trim(), icon: 'bookmark' });
      setModal(true);
    }, 300);
  };

  // Step 3: address chosen → save with the nickname
  const handleNewPlaceAddressChosen = ({ address, lat, lng }) => {
    setModal(false);
    addPlace({ label: pendingNickname, address, lat, lng });
    setPendingNickname('');
  };

  // (unused for new flow but kept for compat)
  const handleSaveNickname = handleNicknameConfirmed;

  // ── Open modal ────────────────────────────
  const openModal = (target) => {
    setEditTarget(target);
    setModal(true);
  };

  // ── Navigate to MapScreen ─────────────────
  const handleSetOnMap = (target) => {
    setModal(false);
    setTimeout(() => {
      router.push({
        pathname: '/shared/MapScreen',
        params: {
          selectionType: 'saved_address',
          targetKey: target.key,
          targetLabel: target.label,
        },
      });
    }, 300);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  const customPlaces = places.filter(
    p => !ADDRESS_TYPES.some(t => t.label.toLowerCase() === p.label.toLowerCase())
  );

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
        {/* ── ILLUSTRATION ── */}
        <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 20 }}>
          <MapIllustration />
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#111', marginTop: 16 }}>
            Saved addresses
          </Text>
          <Text style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
            Easily access your favorite locations.
          </Text>
        </View>

        <View style={{ height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 20, marginBottom: 8 }} />

        {/* ── HOME / WORK ── */}
        {ADDRESS_TYPES.map(type => {
          const saved = findByLabel(type.label);
          return (
            <AddressRow
              key={type.key}
              icon={saved ? type.filledIcon : type.icon}
              label={type.label}
              value={saved?.address || null}
              placeholder="Tap to set the address"
              onPress={() => openModal({ key: type.key, label: type.label, icon: type.filledIcon })}
              onDelete={saved ? () => deletePlace(saved.id) : null}
            />
          );
        })}

        {/* ── CUSTOM PLACES ── */}
        {customPlaces.map(place => (
          <AddressRow
            key={place.id}
            icon="bookmark"
            label={place.label}
            value={place.address}
            placeholder=""
            onPress={() => openModal({ key: 'custom', label: place.label, icon: 'bookmark', id: place.id })}
            onDelete={() => deletePlace(place.id)}
          />
        ))}

        {/* ── ADD NEW ── */}
        <TouchableOpacity
          onPress={handleOpenNewPlace}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 18 }}
          activeOpacity={0.7}
        >
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: '#F5F5F5',
            alignItems: 'center', justifyContent: 'center', marginRight: 16,
          }}>
            <Ionicons name="add" size={22} color="#111" />
          </View>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>Add a new address</Text>
        </TouchableOpacity>
      </Animated.ScrollView>

      {/* ── ADDRESS PICKER MODAL (Home / Work / custom) ── */}
      <AddressModal
        visible={modalVisible}
        target={editTarget}
        isNew={editTarget?.key === 'new'}
        onClose={() => setModal(false)}
        onSave={editTarget?.key === 'new' ? handleNewPlaceAddressChosen : handleSave}
        onSetOnMap={() => handleSetOnMap(editTarget)}
      />

      {/* ── NICKNAME MODAL (only for new custom places) ── */}
      <NicknameModal
        visible={nicknameModal}
        address=""
        value={nickname}
        onChange={setNickname}
        onClose={() => { setNicknameModal(false); setNickname(''); }}
        onSave={handleNicknameConfirmed}
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
      <View style={{
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: value ? '#111' : '#F5F5F5',
        alignItems: 'center', justifyContent: 'center', marginRight: 16,
      }}>
        <Ionicons name={icon} size={19} color={value ? '#fff' : '#555'} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111' }}>{label}</Text>
        {value ? (
          <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }} numberOfLines={1}>{value}</Text>
        ) : (
          <Text style={{ fontSize: 13, color: '#BBB', marginTop: 2 }}>{placeholder}</Text>
        )}
      </View>

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
// ADDRESS SEARCH MODAL
// ─────────────────────────────────────────────
function AddressModal({ visible, target, isNew, onClose, onSave, onSetOnMap }) {
  const [query, setQuery]      = useState('');
  const [results, setResults]  = useState([]);
  const [searching, setSearch] = useState(false);
  const debounceRef            = useRef(null);

  React.useEffect(() => {
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
    onSave({
      label:   target?.label || place.shortName,
      address: place.displayName,
      lat:     place.latitude,
      lng:     place.longitude,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>

          {/* HEADER */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12,
            borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
          }}>
            <TouchableOpacity onPress={onClose} style={{ padding: 6, marginRight: 8 }}>
              <Ionicons name="arrow-back" size={22} color="#111" />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#111', flex: 1 }}>
              {isNew ? 'Choose a location' : target?.label ? `Set ${target.label}` : 'Add address'}
            </Text>
          </View>

          {/* SEARCH BAR */}
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

          {/* RESULTS */}
          <FlatList
            data={results}
            keyExtractor={item => String(item.id)}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: '#F5F5F5', marginLeft: 60 }} />
            )}
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
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: '#F0F0F0',
                  alignItems: 'center', justifyContent: 'center', marginRight: 14,
                }}>
                  <Ionicons name="location-outline" size={17} color="#555" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111' }}>
                    {item.shortName || item.displayName}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />

          {/* SET ON MAP */}
          <TouchableOpacity
            onPress={onSetOnMap}
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
              alignItems: 'center', justifyContent: 'center', marginRight: 14,
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
// NICKNAME MODAL  (step 2 for new custom place)
// ─────────────────────────────────────────────
function NicknameModal({ visible, address, value, onChange, onClose, onSave }) {
  const canSave = value.trim().length > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, backgroundColor: '#fff' }}>

          {/* HEADER */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12,
            borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
          }}>
            <TouchableOpacity onPress={onClose} style={{ padding: 6, marginRight: 8 }}>
              <Ionicons name="arrow-back" size={22} color="#111" />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#111' }}>
              Add a saved place
            </Text>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 28 }}>

            {/* Step indicator */}
            <Text style={{ fontSize: 13, color: '#BBB', marginBottom: 24, fontWeight: '500' }}>
              Step 1 of 2 — Give this place a name
            </Text>

            {/* NICKNAME INPUT */}
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 8, letterSpacing: 0.4 }}>
              LOCATION NICKNAME
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              borderWidth: 1.5,
              borderColor: '#E5E7EB',
              borderRadius: 12,
              paddingHorizontal: 14,
              height: 52,
            }}>
              <Ionicons name="bookmark-outline" size={18} color="#999" style={{ marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, fontSize: 15, color: '#111' }}
                placeholder="e.g. Alex's home"
                placeholderTextColor="#BBB"
                value={value}
                onChangeText={onChange}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={canSave ? onSave : undefined}
              />
              {value.length > 0 && (
                <TouchableOpacity onPress={() => onChange('')}>
                  <Ionicons name="close-circle" size={18} color="#BBB" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* SAVE BUTTON */}
          <View style={{
            paddingHorizontal: 20,
            paddingBottom: Platform.OS === 'ios' ? 36 : 20,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: '#F0F0F0',
          }}>
            <TouchableOpacity
              onPress={onSave}
              disabled={!canSave}
              activeOpacity={0.8}
              style={{
                backgroundColor: canSave ? '#111' : '#E5E7EB',
                borderRadius: 50,
                paddingVertical: 15,
                alignItems: 'center',
              }}
            >
              <Text style={{
                fontSize: 16, fontWeight: '700',
                color: canSave ? '#fff' : '#BBB',
              }}>
                Next: Pick location
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// MAP ILLUSTRATION
// ─────────────────────────────────────────────
function MapIllustration() {
  return (
    <View style={{ width: 140, height: 120, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 120, height: 80, backgroundColor: '#ceddff', borderRadius: 12,
        transform: [{ rotateX: '20deg' }, { rotateZ: '-5deg' }],
        shadowColor: '#164dcd', shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
        alignItems: 'center', justifyContent: 'center', position: 'relative',
      }}>
        <View style={{ position: 'absolute', top: '33%', left: 0, right: 0, height: 1, backgroundColor: '#88acfe' }} />
        <View style={{ position: 'absolute', top: '66%', left: 0, right: 0, height: 1, backgroundColor: '#88acfe' }} />
        <View style={{ position: 'absolute', left: '33%', top: 0, bottom: 0, width: 1, backgroundColor: '#88acfe' }} />
        <View style={{ position: 'absolute', left: '66%', top: 0, bottom: 0, width: 1, backgroundColor: '#88acfe' }} />
      </View>
      <View style={{
        position: 'absolute', top: 10,
        width: 36, height: 36, borderRadius: 18, backgroundColor: '#164dcd',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#164dcd', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
      }}>
        <Ionicons name="location" size={20} color="#fff" />
      </View>
      {[
        { top: 20, left: 10,  color: '#5479d5', size: 10 },
        { top: 55, left: 15,  color: '#5479d5', size: 8 },
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