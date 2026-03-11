import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardTypeOptions,
} from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '../../services/api';

import {
  VALID_CAR_BRANDS,
  VALID_COLORS,
  validateBrand,
  validateModel,
  validateLicensePlate,
  validateColor,
  validateAllVehicleFields,
  getModelsForBrand,
  formatLicensePlateInput,
} from '../../utils/validationVehicule';

// ── Field ─────────────────────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', error }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputBox, focused && s.inputBoxFocused, !!error && s.inputBoxError]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#999"
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={s.inputText}
        />
      </View>
      {!!error && <Text style={s.errorText}>{error}</Text>}
    </View>
  );
}

// ── Suggestion list ───────────────────────────────────────────────────────────
function SuggestionList({ items, onSelect }: { items: string[]; onSelect: (v: string) => void }) {
  if (!items.length) return null;
  return (
    <View style={s.suggestionBox}>
      {items.map((item, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onSelect(item)}
          style={[s.suggestionRow, i < items.length - 1 && s.suggestionDivider]}
          activeOpacity={0.7}
        >
          <Ionicons name="search-outline" size={14} color="#999" style={{ marginRight: 8 }} />
          <Text style={s.suggestionText}>{item}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────
function ToggleRow({ icon, label, value, onToggle }: { icon: any; label: string; value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={s.toggleRow}>
      <View style={[s.toggleIcon, value && s.toggleIconActive]}>
        <Ionicons name={icon} size={16} color={value ? '#fff' : '#888'} />
      </View>
      <Text style={s.toggleLabel}>{label}</Text>
      <View style={[s.track, value && s.trackActive]}>
        <View style={[s.thumb, value && s.thumbActive]} />
      </View>
    </TouchableOpacity>
  );
}

// ── Option card ───────────────────────────────────────────────────────────────
function OptionCard({ icon, title, subtitle, onPress, loading = false }: {
  icon: any; title: string; subtitle: string; onPress: () => void; loading?: boolean;
}) {
  return (
    <TouchableOpacity style={s.optionCard} onPress={onPress} activeOpacity={0.8} disabled={loading}>
      <View style={s.optionIconWrap}>
        {loading
          ? <ActivityIndicator size="small" color="#fff" />
          : <Ionicons name={icon} size={22} color="#fff" />
        }
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.optionTitle}>{title}</Text>
        <Text style={s.optionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#ccc" />
    </TouchableOpacity>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProfileSetupScreen() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading]         = useState(false);
  const [gpsLoading, setGpsLoading]   = useState(false);

  const [vehicleData, setVehicleData] = useState({
    marque:  '',
    modele:  '',
    plaque:  '',
    couleur: '',
  });

  const [preferences, setPreferences] = useState({
    talkative:       false,
    radio_on:        false,
    smoking_allowed: false,
    pets_allowed:    false,
    car_big:         false,
    works_morning:   false,
    works_afternoon: false,
    works_evening:   false,
    works_night:     false,
  });

  const [errors, setErrors] = useState({
    marque:  '',
    modele:  '',
    plaque:  '',
    couleur: '',
  });

  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([]);
  const [colorSuggestions, setColorSuggestions] = useState<string[]>([]);

  const toggle = (key: string) => setPreferences((p: any) => ({ ...p, [key]: !p[key] }));

  // ── Vehicle handlers ──────────────────────────────────────────────────────
  const handleBrandChange = (text: string) => {
    setVehicleData({ ...vehicleData, marque: text });
    setBrandSuggestions(
      text.trim().length > 0
        ? VALID_CAR_BRANDS.filter((b: string) => b.toLowerCase().includes(text.toLowerCase())).slice(0, 5)
        : []
    );
    setErrors({ ...errors, marque: validateBrand(text) });
  };

  const selectBrand = (brand: string) => {
    setVehicleData({ ...vehicleData, marque: brand });
    setBrandSuggestions([]);
    setErrors({ ...errors, marque: '' });
    const models = getModelsForBrand(brand);
    if (models.length) setModelSuggestions(models);
  };

  const handleModelChange = (text: string) => {
    setVehicleData({ ...vehicleData, modele: text });
    const avail = getModelsForBrand(vehicleData.marque);
    setModelSuggestions(
      text.trim().length > 0 && avail.length
        ? avail.filter((m: string) => m.toLowerCase().includes(text.toLowerCase())).slice(0, 5)
        : []
    );
    setErrors({ ...errors, modele: validateModel(text, vehicleData.marque) });
  };

  const handleColorChange = (text: string) => {
    setVehicleData({ ...vehicleData, couleur: text });
    setColorSuggestions(
      text.trim().length > 0
        ? VALID_COLORS.filter((c: string) => c.toLowerCase().includes(text.toLowerCase())).slice(0, 5)
        : []
    );
    setErrors({ ...errors, couleur: validateColor(text) });
  };

  const handleLicensePlateChange = (text: string) => {
    const formatted = formatLicensePlateInput(text, ' ');
    setVehicleData({ ...vehicleData, plaque: formatted });
    const digits = formatted.replace(/\D/g, '');
    setErrors({
      ...errors,
      plaque: digits.length === 11 || digits.length === 0
        ? validateLicensePlate(formatted)
        : '',
    });
  };

  // ── Step 1 submit: Vehicle ────────────────────────────────────────────────
  const handleStep1Next = async () => {
    const newErrors = validateAllVehicleFields(vehicleData);
    setErrors(newErrors);
    if (!Object.values(newErrors).every((e) => e === '')) return;
    setLoading(true);
    try {
      await api.post('/drivers/vehicle', {
        marque:  vehicleData.marque,
        modele:  vehicleData.modele  || null,
        plaque:  vehicleData.plaque  || null,
        couleur: vehicleData.couleur || null,
      });
      setCurrentStep(2);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save vehicle');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Work zone — GPS ───────────────────────────────────────────────
  const handleUseCurrentLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await api.patch('/drivers/profile/location', {
        latitude:  loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      setCurrentStep(3);
    } catch (err: any) {
      Alert.alert(
        'Location mismatch',
        err.response?.data?.detail || err.response?.data?.message || 'Location does not match your wilaya.'
      );
    } finally {
      setGpsLoading(false);
    }
  };

  // ── Step 2: Work zone — Map ───────────────────────────────────────────────
  const handleSetOnMap = () => {
    router.push({
      pathname: '/shared/MapScreen',
      params:   { selectionType: 'work_zone' },
    });
    // MapScreen appellera router.replace('/(driverTabs)/DriverHomeScreen') directement
    // donc on ne revient pas à step 3 depuis la map
    // Si tu veux revenir au step 3 après la map, change le comportement dans MapScreen
  };

  // ── Step 3 submit: Preferences ────────────────────────────────────────────
  const handleCompleteSetup = async () => {
    setLoading(true);
    try {
      await api.put('/drivers/preferences', preferences);
      Alert.alert(
        'All done!',
        'Your profile is complete. Time to start driving!',
        [{ text: "Let's go 🚗", onPress: () => router.replace('/(driverTabs)/DriverHomeScreen') }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 1 — Vehicle ──────────────────────────────────────────────────────
  const renderVehicleForm = () => (
    <View>
      <View style={s.headerWrap}>
        <View style={s.headerBadge}>
          <Ionicons name="car-sport-outline" size={20} color="#fff" />
        </View>
        <Text style={s.headerTitle}>Your Vehicle</Text>
        <Text style={s.headerSub}>Tell us about the car you'll be driving</Text>
      </View>

      <View style={s.card}>
        <Field label="Brand *"         value={vehicleData.marque}  onChangeText={handleBrandChange}        placeholder="Peugeot, Toyota, Mercedes..." error={errors.marque} />
        <SuggestionList items={brandSuggestions} onSelect={selectBrand} />

        <Field label="Model"           value={vehicleData.modele}  onChangeText={handleModelChange}        placeholder="308, Corolla, C-Class..."      error={errors.modele} />
        <SuggestionList items={modelSuggestions} onSelect={(m) => { setVehicleData({ ...vehicleData, modele: m }); setModelSuggestions([]); setErrors({ ...errors, modele: '' }); }} />

        <Field label="License Plate *" value={vehicleData.plaque}  onChangeText={handleLicensePlateChange} placeholder="123456 126 16" keyboardType="numeric" error={errors.plaque} />

        <Field label="Color"           value={vehicleData.couleur} onChangeText={handleColorChange}        placeholder="Black, White, Red..."         error={errors.couleur} />
        <SuggestionList items={colorSuggestions} onSelect={(c) => { setVehicleData({ ...vehicleData, couleur: c }); setColorSuggestions([]); setErrors({ ...errors, couleur: '' }); }} />
      </View>

      <TouchableOpacity style={[s.cta, loading && s.ctaDisabled]} onPress={handleStep1Next} disabled={loading} activeOpacity={0.85}>
        <Text style={s.ctaText}>{loading ? 'Saving...' : 'Continue'}</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  // ── STEP 2 — Work Zone ────────────────────────────────────────────────────
  const renderWorkZoneForm = () => (
    <View>
      <View style={s.headerWrap}>
        <View style={[s.headerBadge, { backgroundColor: '#111' }]}>
          <Ionicons name="location-outline" size={20} color="#fff" />
        </View>
        <Text style={s.headerTitle}>Your Work Zone</Text>
        <Text style={s.headerSub}>Set your usual working area so passengers nearby can find you</Text>
      </View>

      <View style={s.infoBox}>
        <Ionicons name="shield-checkmark-outline" size={16} color="#555" style={{ marginRight: 8, marginTop: 1 }} />
        <Text style={s.infoText}>Your exact location is never shared with passengers — only your wilaya is visible.</Text>
      </View>

      <Text style={s.sectionLabel}>HOW WOULD YOU LIKE TO SET IT?</Text>
      <View style={s.card}>
        <OptionCard
          icon="locate"
          title="Use my current location"
          subtitle="Quick — uses your GPS position right now"
          onPress={handleUseCurrentLocation}
          loading={gpsLoading}
        />
        <View style={s.optionDivider} />
        <OptionCard
          icon="map-outline"
          title="Set on map"
          subtitle="Pin your exact work area manually"
          onPress={handleSetOnMap}
        />
      </View>

      <TouchableOpacity style={s.ctaBack} onPress={() => setCurrentStep(1)} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={18} color="#111" />
      </TouchableOpacity>
    </View>
  );

  // ── STEP 3 — Style ────────────────────────────────────────────────────────
  const renderPreferencesForm = () => (
    <View>
      <View style={s.headerWrap}>
        <View style={[s.headerBadge, { backgroundColor: '#111' }]}>
          <Ionicons name="options-outline" size={20} color="#fff" />
        </View>
        <Text style={s.headerTitle}>Your Style</Text>
        <Text style={s.headerSub}>Help passengers know what to expect</Text>
      </View>

      <Text style={s.sectionLabel}>RIDE STYLE</Text>
      <View style={s.card}>
        <ToggleRow icon="chatbubbles-outline"   label="Talkative"       value={preferences.talkative}       onToggle={() => toggle('talkative')} />
        <ToggleRow icon="musical-notes-outline" label="Radio on"        value={preferences.radio_on}        onToggle={() => toggle('radio_on')} />
        <ToggleRow icon="flame-outline"         label="Smoking allowed" value={preferences.smoking_allowed} onToggle={() => toggle('smoking_allowed')} />
        <ToggleRow icon="paw-outline"           label="Pets welcome"    value={preferences.pets_allowed}    onToggle={() => toggle('pets_allowed')} />
        <ToggleRow icon="car-sport-outline"     label="Large car"       value={preferences.car_big}         onToggle={() => toggle('car_big')} />
      </View>

      <Text style={s.sectionLabel}>WORKING HOURS</Text>
      <View style={s.card}>
        <ToggleRow icon="sunny-outline"        label="Morning  6am – 12pm"  value={preferences.works_morning}   onToggle={() => toggle('works_morning')} />
        <ToggleRow icon="partly-sunny-outline" label="Afternoon 12pm – 6pm" value={preferences.works_afternoon} onToggle={() => toggle('works_afternoon')} />
        <ToggleRow icon="moon-outline"         label="Evening  6pm – 10pm"  value={preferences.works_evening}   onToggle={() => toggle('works_evening')} />
        <ToggleRow icon="cloudy-night-outline" label="Night  10pm – 6am"    value={preferences.works_night}     onToggle={() => toggle('works_night')} />
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
        <TouchableOpacity style={s.ctaBack} onPress={() => setCurrentStep(2)} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color="#111" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.cta, { flex: 1 }, loading && s.ctaDisabled]}
          onPress={handleCompleteSetup}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={s.ctaText}>{loading ? 'Saving...' : 'Complete setup'}</Text>
          <Ionicons name="checkmark" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Complete your profile', headerBackVisible: false, headerShadowVisible: false }} />
      <ScrollView
        style={s.screen}
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep === 1 && renderVehicleForm()}
        {currentStep === 2 && renderWorkZoneForm()}
        {currentStep === 3 && renderPreferencesForm()}
      </ScrollView>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: '#F8F8F8',
  },
  headerWrap: {
    alignItems:   'center',
    marginBottom: 28,
  },
  headerBadge: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: '#111',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    14,
  },
  headerTitle: {
    fontSize:      26,
    fontWeight:    '800',
    color:         '#111',
    marginBottom:  6,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize:  14,
    color:     '#888',
    textAlign: 'center',
  },
  card: {
    backgroundColor:   '#fff',
    borderRadius:      20,
    paddingHorizontal: 20,
    paddingVertical:   8,
    marginBottom:      20,
    shadowColor:       '#000',
    shadowOpacity:     0.06,
    shadowRadius:      12,
    shadowOffset:      { width: 0, height: 4 },
    elevation:         3,
  },
  sectionLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         '#aaa',
    letterSpacing: 1.2,
    marginBottom:  8,
    marginLeft:    4,
  },
  fieldWrap: {
    marginVertical: 10,
  },
  label: {
    fontSize:      12,
    fontWeight:    '700',
    color:         '#555',
    marginBottom:  6,
    letterSpacing: 0.3,
  },
  inputBox: {
    backgroundColor:   '#F7F7F7',
    borderRadius:      12,
    borderWidth:       1.5,
    borderColor:       '#EBEBEB',
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  inputBoxFocused: {
    borderColor:     '#111',
    backgroundColor: '#fff',
  },
  inputBoxError: {
    borderColor: '#EF4444',
  },
  inputText: {
    fontSize: 15,
    color:    '#111',
  },
  errorText: {
    fontSize:  12,
    color:     '#EF4444',
    marginTop: 4,
  },
  suggestionBox: {
    backgroundColor: '#fff',
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     '#EBEBEB',
    marginTop:       -6,
    marginBottom:    8,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
  },
  suggestionRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  suggestionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  suggestionText: {
    fontSize:   14,
    color:      '#333',
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  toggleIcon: {
    width:           32,
    height:          32,
    borderRadius:    10,
    backgroundColor: '#F0F0F0',
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     12,
  },
  toggleIconActive: {
    backgroundColor: '#111',
  },
  toggleLabel: {
    flex:       1,
    fontSize:   15,
    color:      '#222',
    fontWeight: '500',
  },
  track: {
    width:           44,
    height:          24,
    borderRadius:    12,
    backgroundColor: '#E5E7EB',
    padding:         2,
    justifyContent:  'center',
  },
  trackActive: {
    backgroundColor: '#111',
  },
  thumb: {
    width:        20,
    height:       20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf:    'flex-start',
    shadowColor:  '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation:    2,
  },
  thumbActive: {
    alignSelf: 'flex-end',
  },
  cta: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    backgroundColor: '#111',
    borderRadius:    16,
    paddingVertical: 16,
  },
  ctaDisabled: {
    backgroundColor: '#999',
  },
  ctaText: {
    color:      '#fff',
    fontSize:   16,
    fontWeight: '700',
  },
  ctaBack: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: '#F0F0F0',
    alignItems:      'center',
    justifyContent:  'center',
  },
  
  // Info box
  infoBox:{
   flexDirection: 'row',
   alignItems: 'flex-start',
   backgroundColor: '#F0F9F0', 
   borderRadius: 12, 
   padding: 14, 
   marginBottom: 20 
  },
  infoText:{ flex: 1, 
    fontSize: 13, 
    color: '#555', 
    lineHeight: 18 
  },

  // Option cards
  optionCard:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  optionIconWrap:    { width: 44, height: 44, borderRadius: 14, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  optionTitle:       { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 2 },
  optionSubtitle:    { fontSize: 12, color: '#888' },
  optionDivider:     { height: 1, backgroundColor: '#F5F5F5' },
});