import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Animated,
  Alert,
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface SavedPlace {
  id: number;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

interface EditTarget {
  key: string;
  label: string;
  icon: string;
  id?: number;
}

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function SavedPlacesScreen() {
  const [places, setPlaces]         = useState<SavedPlace[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalVisible, setModal]    = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  // Nickname first, then address (for "Add new place" flow)
  const [nicknameModal, setNicknameModal]   = useState(false);
  const [pendingPlace, setPendingPlace]     = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [nickname, setNickname]             = useState('');
  const [pendingNickname, setPendingNickname] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Undo delete toast ─────────────────────
  const [pendingDelete, setPendingDelete] = useState<{ id: number; label: string } | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // ── Edit / menu state ─────────────────────
  const [menuTarget, setMenuTarget] = useState<{
    icon: string;
    isFixed: any; id: number; label: string; address: string; lat: number; lng: number
} | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editNicknameModal, setEditNicknameModal] = useState(false);
  const [editNickname, setEditNickname] = useState('');

  // ── Load from API ──────────────────────────
  const loadPlaces = async () => {
    try {
      const res = await api.get('/passengers/saved-places');
      setPlaces(res.data.data || []);
    } catch (e: any) {
      console.error('loadPlaces:', e.message);
      Alert.alert('Error', 'Failed to load saved places.');
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  };

  useFocusEffect(useCallback(() => { loadPlaces(); }, []));

  const findByLabel = (label: string) =>
    places.find(p => p.label.toLowerCase() === label.toLowerCase()) || null;

  // ── ADD ───────────────────────────────────
  const addPlace = async ({ label, address, lat, lng }: { label: string; address: string; lat: number; lng: number }) => {
    try {
      const res = await api.post('/passengers/saved-places', { label, address, lat, lng });
      setPlaces(prev => [res.data.data, ...prev]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || e.message);
    }
  };

  // ── UPDATE ────────────────────────────────
  const updatePlace = async (id: number, payload: Partial<SavedPlace>) => {
    try {
      const res = await api.put(`/passengers/saved-places/${id}`, payload);
      setPlaces(prev => prev.map(p => (p.id === id ? res.data.data : p)));
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || e.message);
    }
  };

  // ── DELETE with 2s undo ───────────────────
  const deletePlace = (id: number, label: string) => {
    // Clear any existing timer
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);

    // Optimistically remove from list
    setPlaces(prev => prev.filter(p => p.id !== id));

    // Show undo toast
    setPendingDelete({ id, label });
    Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true }).start();

    // After 2s, actually delete from server
    deleteTimerRef.current = setTimeout(async () => {
      setPendingDelete(null);
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      try {
        await api.delete(`/passengers/saved-places/${id}`);
      } catch (e) {
        // If server delete fails, reload places
        loadPlaces();
      }
    }, 2500);
  };

  const undoDelete = () => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (pendingDelete) {
      // Reload to restore the place
      loadPlaces();
    }
    setPendingDelete(null);
    Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  useEffect(() => {
    return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); };
  }, []);

  // ── Edit nickname ─────────────────────────
  const openMenu = (place: any) => {
    setMenuTarget(place);
    setMenuVisible(true);
  };

  const handleEditNicknameSave = async () => {
    if (!editNickname.trim() || !menuTarget) return;
    setEditNicknameModal(false);
    await updatePlace(menuTarget.id, {
      label:   editNickname.trim(),
      address: menuTarget.address,
      lat:     menuTarget.lat,
      lng:     menuTarget.lng,
    });
    setMenuTarget(null);
  };

  // ── Save from modal (Home / Work) ─────────
  const handleSave = async ({ label, address, lat, lng }: { label: string; address: string; lat: number; lng: number }) => {
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
  const handleNewPlaceAddressChosen = ({ address, lat, lng }: { address: string; lat: number; lng: number }) => {
    setModal(false);
    addPlace({ label: pendingNickname, address, lat, lng });
    setPendingNickname('');
  };

  // (unused for new flow but kept for compat)
  const handleSaveNickname = handleNicknameConfirmed;

  // ── Open modal ────────────────────────────
  const openModal = (target: EditTarget) => {
    setEditTarget(target);
    setModal(true);
  };

  // ── Navigate to MapScreen ─────────────────
  const handleSetOnMap = (target: EditTarget | null) => {
    setModal(false);
    setTimeout(() => {
      router.push({
        pathname: '/shared/MapScreen',
        params: {
          selectionType: 'saved_address',
          targetKey: target?.key,
          targetLabel: target?.label,
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
              onDelete={saved ? () => deletePlace(saved.id, type.label) : null}
              onMenuPress={saved ? () => openMenu({ ...saved, isFixed: true, icon: type.filledIcon }) : undefined}
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
            onDelete={() => deletePlace(place.id, place.label)}
            onMenuPress={() => openMenu({ ...place, isFixed: false, icon: 'bookmark' })}
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

      {/* ── 3-DOT BOTTOM SHEET MENU ── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        />
        <View style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: Platform.OS === 'ios' ? 40 : 24,
          paddingTop: 12,
        }}>
          {/* Handle */}
          <View style={{ width: 36, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

          {/* Place name header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name={(menuTarget?.icon || "bookmark") as any} size={18} color="#fff" />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111' }}>{menuTarget?.label}</Text>
              <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }} numberOfLines={1}>{menuTarget?.address}</Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: '#F0F0F0', marginBottom: 8 }} />

          {/* Edit — only for custom places */}
          {!menuTarget?.isFixed && (
            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);
                setEditNickname(menuTarget?.label || '');
                setTimeout(() => setEditNicknameModal(true), 300);
              }}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <Ionicons name="pencil-outline" size={19} color="#111" />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>Edit name</Text>
            </TouchableOpacity>
          )}

          {/* Delete */}
          <TouchableOpacity
            onPress={() => {
              setMenuVisible(false);
              if (menuTarget) deletePlace(menuTarget.id, menuTarget.label);
            }}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Ionicons name="trash-outline" size={19} color="#EF4444" />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#EF4444' }}>Remove</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── EDIT NICKNAME MODAL ── */}
      <Modal
        visible={editNicknameModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditNicknameModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12,
              borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
            }}>
              <TouchableOpacity onPress={() => setEditNicknameModal(false)} style={{ padding: 6, marginRight: 8 }}>
                <Ionicons name="arrow-back" size={22} color="#111" />
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111' }}>Edit saved place</Text>
            </View>

            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 28 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 8, letterSpacing: 0.4 }}>
                LOCATION NICKNAME
              </Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                borderWidth: 1.5, borderColor: '#E5E7EB',
                borderRadius: 12, paddingHorizontal: 14, height: 52,
              }}>
                <Ionicons name="bookmark-outline" size={18} color="#999" style={{ marginRight: 10 }} />
                <TextInput
                  style={{ flex: 1, fontSize: 15, color: '#111' }}
                  placeholder="e.g. Grandma's house"
                  placeholderTextColor="#BBB"
                  value={editNickname}
                  onChangeText={setEditNickname}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleEditNicknameSave}
                />
                {editNickname.length > 0 && (
                  <TouchableOpacity onPress={() => setEditNickname('')}>
                    <Ionicons name="close-circle" size={18} color="#BBB" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={{
              paddingHorizontal: 20,
              paddingBottom: Platform.OS === 'ios' ? 36 : 20,
              paddingTop: 12,
              borderTopWidth: 1, borderTopColor: '#F0F0F0',
            }}>
              <TouchableOpacity
                onPress={handleEditNicknameSave}
                disabled={!editNickname.trim()}
                activeOpacity={0.8}
                style={{
                  backgroundColor: editNickname.trim() ? '#111' : '#E5E7EB',
                  borderRadius: 50, paddingVertical: 15, alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: editNickname.trim() ? '#fff' : '#BBB' }}>
                  Save place
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── UNDO DELETE TOAST ── */}
      {pendingDelete && (
        <Animated.View style={{
          position: 'absolute', bottom: 30, left: 20, right: 20,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0,1], outputRange: [100, 0] }) }],
          opacity: toastAnim,
          backgroundColor: '#111', borderRadius: 16,
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, paddingVertical: 14,
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 10,
        }}>
          <Ionicons name="trash-outline" size={18} color="#fff" style={{ marginRight: 10 }} />
          <Text style={{ flex: 1, color: '#fff', fontSize: 14, fontWeight: '500' }}>
            "{pendingDelete.label}" removed
          </Text>
          <TouchableOpacity onPress={undoDelete} activeOpacity={0.7}>
            <Text style={{ color: '#60A5FA', fontWeight: '700', fontSize: 14 }}>Undo</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// ADDRESS ROW
// ─────────────────────────────────────────────
function AddressRow({ icon, label, value, placeholder, onPress, onDelete, onMenuPress }: {
  icon: string;
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
  onDelete: (() => void) | null;
  onMenuPress?: () => void;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    }}>
      {/* Main tappable area */}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 }}
      >
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: value ? '#111' : '#F5F5F5',
          alignItems: 'center', justifyContent: 'center', marginRight: 16,
        }}>
          <Ionicons name={icon as any} size={19} color={value ? '#fff' : '#555'} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111' }}>{label}</Text>
          {value ? (
            <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }} numberOfLines={1}>{value}</Text>
          ) : (
            <Text style={{ fontSize: 13, color: '#BBB', marginTop: 2 }}>{placeholder}</Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Action button — outside the row touchable to avoid conflict */}
      {onMenuPress ? (
        <TouchableOpacity
          onPress={onMenuPress}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={{ paddingRight: 20, paddingVertical: 16 }}
        >
          <Ionicons name="ellipsis-vertical" size={18} color="#BBB" />
        </TouchableOpacity>
      ) : (
        <View style={{ paddingRight: 20 }}>
          <Ionicons name="chevron-forward" size={16} color="#CCC" />
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// ADDRESS SEARCH MODAL
// ─────────────────────────────────────────────
function AddressModal({ visible, target, isNew, onClose, onSave, onSetOnMap }: {
  visible: boolean;
  target: EditTarget | null;
  isNew?: boolean;
  onClose: () => void;
  onSave: (data: { label: string; address: string; lat: number; lng: number }) => void;
  onSetOnMap: () => void;
}) {
  const [query, setQuery]      = useState('');
  const [results, setResults]  = useState<any[]>([]);
  const [searching, setSearch] = useState(false);
  const debounceRef            = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!visible) { setQuery(''); setResults([]); }
  }, [visible]);

  const handleType = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setResults([]); return; }
    setSearch(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchPlaces(text);
      setResults(res);
      setSearch(false);
    }, 500);
  };

  const handleSelect = (place: any) => {
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
function NicknameModal({ visible, address, value, onChange, onClose, onSave }: {
  visible: boolean;
  address: string;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
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
          top: dot.top, left: (dot as any).left, right: (dot as any).right,
        }} />
      ))}
    </View>
  );
}
