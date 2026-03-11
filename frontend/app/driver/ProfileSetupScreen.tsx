import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  TextInput,
  KeyboardTypeOptions ,
} from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
}
// ── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', error }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputBox, focused && s.inputBoxFocused, error && s.inputBoxError]}>
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
function SuggestionList({ items, onSelect }) {
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
function ToggleRow({ icon, label, value, onToggle }) {
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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProfileSetupScreen() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading]         = useState(false);

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

  const [brandSuggestions, setBrandSuggestions] = useState([]);
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [colorSuggestions, setColorSuggestions] = useState([]);

  const toggle = (key) => setPreferences(p => ({ ...p, [key]: !p[key] }));

  const handleBrandChange = (text) => {
    setVehicleData({ ...vehicleData, marque: text });
    setBrandSuggestions(
      text.trim().length > 0
        ? VALID_CAR_BRANDS.filter(b => b.toLowerCase().includes(text.toLowerCase())).slice(0, 5)
        : []
    );
    setErrors({ ...errors, marque: validateBrand(text) });
  };

  const selectBrand = (brand) => {
    setVehicleData({ ...vehicleData, marque: brand });
    setBrandSuggestions([]);
    setErrors({ ...errors, marque: '' });
    const models = getModelsForBrand(brand);
    if (models.length) setModelSuggestions(models);
  };

  const handleModelChange = (text) => {
    setVehicleData({ ...vehicleData, modele: text });
    const avail = getModelsForBrand(vehicleData.marque);
    setModelSuggestions(
      text.trim().length > 0 && avail.length
        ? avail.filter(m => m.toLowerCase().includes(text.toLowerCase())).slice(0, 5)
        : []
    );
    setErrors({ ...errors, modele: validateModel(text, vehicleData.marque) });
  };

  const handleColorChange = (text) => {
    setVehicleData({ ...vehicleData, couleur: text });
    setColorSuggestions(
      text.trim().length > 0
        ? VALID_COLORS.filter(c => c.toLowerCase().includes(text.toLowerCase())).slice(0, 5)
        : []
    );
    setErrors({ ...errors, couleur: validateColor(text) });
  };

  const handleLicensePlateChange = (text) => {
    const formatted = formatLicensePlateInput(text, ' ');
    setVehicleData({ ...vehicleData, plaque: formatted });
    const digits = formatted.replace(/\D/g, '');
    setErrors({
      ...errors,
      plaque: digits.length === 10 || digits.length === 0
        ? validateLicensePlate(formatted)
        : '',
    });
  };

  const handleNextStep = async () => {
    const newErrors = validateAllVehicleFields(vehicleData);
    setErrors(newErrors);
    if (!Object.values(newErrors).every(e => e === '')) return;
    setLoading(true);
    try {
      await api.post('/drivers/vehicle', {
        marque:  vehicleData.marque,
        modele:  vehicleData.modele  || null,
        plaque:  vehicleData.plaque  || null,
        couleur: vehicleData.couleur || null,
      });
      setCurrentStep(2);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save vehicle');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSetup = async () => {
    setLoading(true);
    try {
      await api.put('/drivers/preferences', preferences);
      Alert.alert(
        'Profile complete!',
        'You can now start offering rides.',
        [{ text: "Let's go", onPress: () => router.replace('/(driverTabs)/DriverHomeScreen') }]
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1 ────────────────────────────────────────────────────────────────
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
        <Field
          label="Brand *"
          value={vehicleData.marque}
          onChangeText={handleBrandChange}
          placeholder="Peugeot, Toyota, Mercedes..."
          error={errors.marque}
        />
        <SuggestionList items={brandSuggestions} onSelect={selectBrand} />

        <Field
          label="Model"
          value={vehicleData.modele}
          onChangeText={handleModelChange}
          placeholder="308, Corolla, C-Class..."
          error={errors.modele}
        />
        <SuggestionList
          items={modelSuggestions}
          onSelect={(m) => {
            setVehicleData({ ...vehicleData, modele: m });
            setModelSuggestions([]);
            setErrors({ ...errors, modele: '' });
          }}
        />

        <Field
          label="License Plate *"
          value={vehicleData.plaque}
          onChangeText={handleLicensePlateChange}
          placeholder="12345 126 16"
          keyboardType="numeric"
          error={errors.plaque}
        />

        <Field
          label="Color"
          value={vehicleData.couleur}
          onChangeText={handleColorChange}
          placeholder="Black, White, Red..."
          error={errors.couleur}
        />
        <SuggestionList
          items={colorSuggestions}
          onSelect={(c) => {
            setVehicleData({ ...vehicleData, couleur: c });
            setColorSuggestions([]);
            setErrors({ ...errors, couleur: '' });
          }}
        />
      </View>

      <TouchableOpacity
        style={[s.cta, loading && s.ctaDisabled]}
        onPress={handleNextStep}
        disabled={loading}
        activeOpacity={0.85}
      >
        <Text style={s.ctaText}>{loading ? 'Saving...' : 'Continue'}</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const renderPreferencesForm = () => (
    <View>
      <View style={s.headerWrap}>
        <View style={[s.headerBadge, { backgroundColor: '#000000' }]}>
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
        <TouchableOpacity style={s.ctaBack} onPress={() => setCurrentStep(1)} activeOpacity={0.7}>
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
      <Stack.Screen options={{ title: '', headerBackVisible: false, headerShadowVisible: false }} />
      <ScrollView
        style={s.screen}
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep === 1 ? renderVehicleForm() : renderPreferencesForm()}
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
});