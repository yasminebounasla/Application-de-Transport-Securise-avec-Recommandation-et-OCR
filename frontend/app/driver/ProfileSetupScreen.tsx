import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Input from '../../components/Input';
import Button from '../../components/Button';
import api from '../../services/api';

import {
  VALID_CAR_BRANDS,
  VALID_COLORS,
  CAR_BRANDS_WITH_MODELS,
  validateBrand,
  validateModel,
  validateYear,
  validateSeats,
  validateLicensePlate,
  validateColor,
  validateAllVehicleFields,
  getModelsForBrand,
  formatLicensePlateInput,
} from '../../utils/validationVehicule';

// ─────────────────────────────────────────────
// PREFERENCE ITEM
// ─────────────────────────────────────────────
function PreferenceItem({ icon, label, value, onToggle }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name={icon} size={18} color="#666" />
        <Text style={{ fontSize: 15, color: '#111' }}>{label}</Text>
      </View>
      <View style={{
        width: 46, height: 26, borderRadius: 13,
        backgroundColor: value ? '#111' : '#E5E7EB',
        padding: 3, justifyContent: 'center',
      }}>
        <View style={{
          width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
          alignSelf: value ? 'flex-end' : 'flex-start',
        }} />
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function ProfileSetupScreen() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Vehicle data
  const [vehicleData, setVehicleData] = useState({
    marque: '',
    modele: '',
    annee: '',
    nbPlaces: '',
    plaque: '',
    couleur: '',
  });

  // Preferences data
  const [preferences, setPreferences] = useState({
    fumeur: false,
    talkative: false,
    radio_on: false,
    smoking_allowed: false,
    pets_allowed: false,
    car_big: false,
    works_morning: false,
    works_afternoon: false,
    works_evening: false,
    works_night: false,
  });

  // Errors state
  const [errors, setErrors] = useState({
    marque: '',
    modele: '',
    annee: '',
    nbPlaces: '',
    plaque: '',
    couleur: '',
  });

  // Suggestions for autocomplete
  const [brandSuggestions, setBrandSuggestions] = useState([]);
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [colorSuggestions, setColorSuggestions] = useState([]);

  const togglePreference = (key) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleBrandChange = (text) => {
    setVehicleData({ ...vehicleData, marque: text });
    if (text.trim().length > 0) {
      const filtered = VALID_CAR_BRANDS.filter(brand =>
        brand.toLowerCase().includes(text.toLowerCase())
      ).slice(0, 5);
      setBrandSuggestions(filtered);
    } else {
      setBrandSuggestions([]);
    }
    setErrors({ ...errors, marque: validateBrand(text) });
  };

  const selectBrand = (brand) => {
    setVehicleData({ ...vehicleData, marque: brand });
    setBrandSuggestions([]);
    setErrors({ ...errors, marque: '' });
    const models = getModelsForBrand(brand);
    if (models.length > 0) setModelSuggestions(models);
  };

  const handleModelChange = (text) => {
    setVehicleData({ ...vehicleData, modele: text });
    const availableModels = getModelsForBrand(vehicleData.marque);
    if (text.trim().length > 0 && availableModels.length > 0) {
      const filtered = availableModels.filter(model =>
        model.toLowerCase().includes(text.toLowerCase())
      ).slice(0, 5);
      setModelSuggestions(filtered);
    } else {
      setModelSuggestions([]);
    }
    setErrors({ ...errors, modele: validateModel(text, vehicleData.marque) });
  };

  const selectModel = (model) => {
    setVehicleData({ ...vehicleData, modele: model });
    setModelSuggestions([]);
    setErrors({ ...errors, modele: '' });
  };

  const handleColorChange = (text) => {
    setVehicleData({ ...vehicleData, couleur: text });
    if (text.trim().length > 0) {
      const filtered = VALID_COLORS.filter(color =>
        color.toLowerCase().includes(text.toLowerCase())
      ).slice(0, 5);
      setColorSuggestions(filtered);
    } else {
      setColorSuggestions([]);
    }
    setErrors({ ...errors, couleur: validateColor(text) });
  };

  const selectColor = (color) => {
    setVehicleData({ ...vehicleData, couleur: color });
    setColorSuggestions([]);
    setErrors({ ...errors, couleur: '' });
  };

  const handleLicensePlateChange = (text) => {
    const formatted = formatLicensePlateInput(text, ' ');
    setVehicleData({ ...vehicleData, plaque: formatted });
    const digitsOnly = formatted.replace(/\D/g, '');
    if (digitsOnly.length === 10 || digitsOnly.length === 0) {
      setErrors({ ...errors, plaque: validateLicensePlate(formatted, vehicleData.annee) });
    } else {
      setErrors({ ...errors, plaque: '' });
    }
  };

  const validateVehicleForm = () => {
    const newErrors = validateAllVehicleFields(vehicleData);
    setErrors(newErrors);
    return Object.values(newErrors).every(error => error === '');
  };

  const handleNextStep = async () => {
    if (!validateVehicleForm()) return;
    setLoading(true);
    try {
      await api.post('/drivers/vehicle', {
        marque:   vehicleData.marque,
        modele:   vehicleData.modele   || null,
        annee:    vehicleData.annee    ? Number(vehicleData.annee)    : null,
        nbPlaces: vehicleData.nbPlaces ? Number(vehicleData.nbPlaces) : null,
        plaque:   vehicleData.plaque   || null,
        couleur:  vehicleData.couleur  || null,
      });
      setCurrentStep(2);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save vehicle');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSetup = async () => {
    setLoading(true);
    try {
      await api.put('/drivers/preferences', preferences);
      Alert.alert(
        'Success!',
        'Your profile is complete. You can now start offering rides!',
        [{ text: 'OK', onPress: () => router.replace('/(driverTabs)/DriverHomeScreen') }]
      );
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  // ── Step indicator ──────────────────────────
  const renderStepIndicator = () => (
    <View className="flex-row items-center justify-center mb-8">
      <View className="items-center">
        <View className={`w-10 h-10 rounded-full items-center justify-center ${currentStep >= 1 ? 'bg-black' : 'bg-gray-300'}`}>
          {currentStep > 1 ? (
            <Ionicons name="checkmark" size={24} color="white" />
          ) : (
            <Text className={`font-bold ${currentStep === 1 ? 'text-white' : 'text-gray-500'}`}>1</Text>
          )}
        </View>
        <Text className="text-xs text-gray-600 mt-1">Vehicle</Text>
      </View>

      <View className={`w-16 h-1 mx-2 ${currentStep >= 2 ? 'bg-black' : 'bg-gray-300'}`} />

      <View className="items-center">
        <View className={`w-10 h-10 rounded-full items-center justify-center ${currentStep >= 2 ? 'bg-black' : 'bg-gray-300'}`}>
          <Text className={`font-bold ${currentStep === 2 ? 'text-white' : 'text-gray-500'}`}>2</Text>
        </View>
        <Text className="text-xs text-gray-600 mt-1">Preferences</Text>
      </View>
    </View>
  );

  // ── Step 1: Vehicle ─────────────────────────
  const renderVehicleForm = () => (
    <View>
      <Text className="text-3xl font-bold text-black mb-2">Add Your Vehicle</Text>
      <Text className="text-gray-500 mb-6">Tell us about the car you'll be driving</Text>

      {/* Brand */}
      <View style={{ marginBottom: 16 }}>
        <Input label="Brand *" value={vehicleData.marque} onChangeText={handleBrandChange} placeholder="e.g. Peugeot, Toyota, Mercedes" error={errors.marque} />
        {brandSuggestions.length > 0 && (
          <View className="bg-white border border-gray-300 rounded-lg mt-1 shadow-sm">
            {brandSuggestions.map((brand, index) => (
              <TouchableOpacity key={index} onPress={() => selectBrand(brand)} className="px-4 py-3 border-b border-gray-100" activeOpacity={0.7}>
                <Text className="text-base text-black">{brand}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Model */}
      <View style={{ marginBottom: 16 }}>
        <Input label="Model" value={vehicleData.modele} onChangeText={handleModelChange} placeholder="e.g. 308, Corolla, C-Class" error={errors.modele} />
        {modelSuggestions.length > 0 && (
          <View className="bg-white border border-gray-300 rounded-lg mt-1 shadow-sm">
            {modelSuggestions.map((model, index) => (
              <TouchableOpacity key={index} onPress={() => selectModel(model)} className="px-4 py-3 border-b border-gray-100" activeOpacity={0.7}>
                <Text className="text-base text-black">{model}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Year & Seats */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <Input
            label="Year" value={vehicleData.annee}
            onChangeText={(text) => { setVehicleData({ ...vehicleData, annee: text }); setErrors({ ...errors, annee: validateYear(text) }); }}
            placeholder="2020" keyboardType="numeric" error={errors.annee}
          />
        </View>
        <View className="flex-1">
          <Input
            label="Seats" value={vehicleData.nbPlaces}
            onChangeText={(text) => { setVehicleData({ ...vehicleData, nbPlaces: text }); setErrors({ ...errors, nbPlaces: validateSeats(text) }); }}
            placeholder="5" keyboardType="numeric" error={errors.nbPlaces}
          />
        </View>
      </View>

      {/* License Plate */}
      <Input
        label="License Plate *" value={vehicleData.plaque}
        onChangeText={handleLicensePlateChange}
        placeholder="12345 126 16" keyboardType="numeric" error={errors.plaque}
        style={{ marginBottom: 16 }}
      />

      {/* Color */}
      <View style={{ marginBottom: 24 }}>
        <Input label="Color" value={vehicleData.couleur} onChangeText={handleColorChange} placeholder="e.g. Black, White, Red" error={errors.couleur} />
        {colorSuggestions.length > 0 && (
          <View className="bg-white border border-gray-300 rounded-lg mt-1 shadow-sm">
            {colorSuggestions.map((color, index) => (
              <TouchableOpacity key={index} onPress={() => selectColor(color)} className="px-4 py-3 border-b border-gray-100" activeOpacity={0.7}>
                <Text className="text-base text-black">{color}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <Button title="Next Step" onPress={handleNextStep} variant="primary" loading={loading} style={{ marginBottom: 0 }} />
    </View>
  );

  // ── Step 2: Preferences ─────────────────────
  const renderPreferencesForm = () => (
    <View>
      <Text className="text-3xl font-bold text-black mb-2">Your Preferences</Text>
      <Text className="text-gray-500 mb-6">Help passengers know what to expect</Text>

      {/* Preferences card */}
      <View style={{
        backgroundColor: '#fff', borderRadius: 16,
        borderWidth: 1, borderColor: '#F0F0F0',
        paddingHorizontal: 16, marginBottom: 16,
      }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#111', paddingTop: 16, paddingBottom: 8 }}>
          Preferences
        </Text>
        <PreferenceItem icon="chatbubbles-outline"   label="Talkative"       value={preferences.talkative}       onToggle={() => togglePreference('talkative')} />
        <PreferenceItem icon="musical-notes-outline" label="Radio On"        value={preferences.radio_on}        onToggle={() => togglePreference('radio_on')} />
        <PreferenceItem icon="flame-outline"         label="Smoking Allowed" value={preferences.smoking_allowed} onToggle={() => togglePreference('smoking_allowed')} />
        <PreferenceItem icon="paw-outline"           label="Pets Allowed"    value={preferences.pets_allowed}    onToggle={() => togglePreference('pets_allowed')} />
        <PreferenceItem icon="car-sport-outline"     label="Large Car"       value={preferences.car_big}         onToggle={() => togglePreference('car_big')} />
      </View>

      {/* Working Hours card */}
      <View style={{
        backgroundColor: '#fff', borderRadius: 16,
        borderWidth: 1, borderColor: '#F0F0F0',
        paddingHorizontal: 16, marginBottom: 32,
      }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#111', paddingTop: 16, paddingBottom: 8 }}>
          Working Hours
        </Text>
        <PreferenceItem icon="sunny-outline"        label="Morning (6am–12pm)"   value={preferences.works_morning}   onToggle={() => togglePreference('works_morning')} />
        <PreferenceItem icon="partly-sunny-outline" label="Afternoon (12pm–6pm)" value={preferences.works_afternoon} onToggle={() => togglePreference('works_afternoon')} />
        <PreferenceItem icon="moon-outline"         label="Evening (6pm–10pm)"   value={preferences.works_evening}   onToggle={() => togglePreference('works_evening')} />
        <PreferenceItem icon="cloudy-night-outline" label="Night (10pm–6am)"     value={preferences.works_night}     onToggle={() => togglePreference('works_night')} />
      </View>

      <View className="flex-row gap-3">
        <Button title="Back" onPress={() => setCurrentStep(1)} variant="secondary" style={{ flex: 1 }} />
        <Button title="Complete Setup" onPress={handleCompleteSetup} variant="primary" loading={loading} style={{ flex: 2 }} />
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Complete Your Profile', headerBackVisible: false }} />
      <ScrollView className="flex-1 bg-white">
        <View className="px-6 py-8">
          {renderStepIndicator()}
          {currentStep === 1 ? renderVehicleForm() : renderPreferencesForm()}
          <View className="h-8" />
        </View>
      </ScrollView>
    </>
  );
}