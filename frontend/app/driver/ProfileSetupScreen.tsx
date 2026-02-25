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

const PreferenceItem = ({ label, value, onToggle }) => (
  <TouchableOpacity
    onPress={onToggle}
    className="flex-row items-center justify-between py-4 border-b border-gray-200"
    activeOpacity={0.7}
  >
    <View className="flex-row items-center flex-1">
      <Text className="text-base text-black">{label}</Text>
    </View>
    <View 
      className={`w-12 h-7 rounded-full p-1 ${
        value ? 'bg-black' : 'bg-gray-300'
      }`}
    >
      <View 
        className={`w-5 h-5 rounded-full bg-white ${
          value ? 'self-end' : 'self-start'
        }`}
      />
    </View>
  </TouchableOpacity>
);

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

  // Toggle preference
  const togglePreference = (key) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Handle brand input change with autocomplete
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

    // Validate brand on change
    const brandError = validateBrand(text);
    setErrors({ ...errors, marque: brandError });
  };

  // Select brand from suggestions
  const selectBrand = (brand) => {
    setVehicleData({ ...vehicleData, marque: brand });
    setBrandSuggestions([]);
    setErrors({ ...errors, marque: '' });
    
    // Update model suggestions when brand is selected
    const models = getModelsForBrand(brand);
    if (models.length > 0) {
      setModelSuggestions(models);
    }
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

    const modelError = validateModel(text, vehicleData.marque);
    setErrors({ ...errors, modele: modelError });
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

    const colorError = validateColor(text);
    setErrors({ ...errors, couleur: colorError });
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
    const plateError = validateLicensePlate(formatted, vehicleData.annee);
    setErrors({ ...errors, plaque: plateError });
  } else {
    setErrors({ ...errors, plaque: '' });
  }
};

  // Validate vehicle form using the imported validation function
  const validateVehicleForm = () => {
    const newErrors = validateAllVehicleFields(vehicleData);
    setErrors(newErrors);
    
    // Return true if no errors (all values are empty strings)
    return Object.values(newErrors).every(error => error === '');
  };

  const handleNextStep = async () => {
    if (!validateVehicleForm()) {
      return;
    }

    setLoading(true);
    try {
      const vehiclePayload = {
        marque: vehicleData.marque,
        modele: vehicleData.modele || null,
        annee: vehicleData.annee ? Number(vehicleData.annee) : null,
        nbPlaces: vehicleData.nbPlaces ? Number(vehicleData.nbPlaces) : null,
        plaque: vehicleData.plaque || null,
        couleur: vehicleData.couleur || null,
      };

      await api.post('/drivers/vehicle', vehiclePayload);
      setCurrentStep(2);
    } catch (error) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to save vehicle'
      );
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
        [
          {
            text: 'OK',
           onPress: () => router.replace('/(driverTabs)/DriverHomeScreen'),
          }
        ]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to save preferences'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View className="flex-row items-center justify-center mb-8">
      <View className="items-center">
        <View 
          className={`w-10 h-10 rounded-full items-center justify-center ${
            currentStep >= 1 ? 'bg-black' : 'bg-gray-300'
          }`}
        >
          {currentStep > 1 ? (
            <Ionicons name="checkmark" size={24} color="white" />
          ) : (
            <Text className={`font-bold ${currentStep === 1 ? 'text-white' : 'text-gray-500'}`}>
              1
            </Text>
          )}
        </View>
        <Text className="text-xs text-gray-600 mt-1">Vehicle</Text>
      </View>

      <View className={`w-16 h-1 mx-2 ${currentStep >= 2 ? 'bg-black' : 'bg-gray-300'}`} />

      <View className="items-center">
        <View 
          className={`w-10 h-10 rounded-full items-center justify-center ${
            currentStep >= 2 ? 'bg-black' : 'bg-gray-300'
          }`}
        >
          <Text className={`font-bold ${currentStep === 2 ? 'text-white' : 'text-gray-500'}`}>
            2
          </Text>
        </View>
        <Text className="text-xs text-gray-600 mt-1">Preferences</Text>
      </View>
    </View>
  );

  // Render Step 1: Vehicle Form
  const renderVehicleForm = () => (
    <View>
      <Text className="text-3xl font-bold text-black mb-2">
        Add Your Vehicle
      </Text>
      <Text className="text-gray-500 mb-6">
        Tell us about the car you'll be driving
      </Text>

      {/* BRAND FIELD WITH AUTOCOMPLETE */}
      <View style={{ marginBottom: 16 }}>
        <Input
          label="Brand *"
          value={vehicleData.marque}
          onChangeText={handleBrandChange}
          placeholder="e.g. Peugeot, Toyota, Mercedes"
          error={errors.marque}
        />
        
        {brandSuggestions.length > 0 && (
          <View className="bg-white border border-gray-300 rounded-lg mt-1 shadow-sm">
            {brandSuggestions.map((brand, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => selectBrand(brand)}
                className="px-4 py-3 border-b border-gray-100"
                activeOpacity={0.7}
              >
                <Text className="text-base text-black">{brand}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* MODEL FIELD WITH AUTOCOMPLETE */}
      <View style={{ marginBottom: 16 }}>
        <Input
          label="Model"
          value={vehicleData.modele}
          onChangeText={handleModelChange}
          placeholder="e.g. 308, Corolla, C-Class"
          error={errors.modele}
        />
        
        {modelSuggestions.length > 0 && (
          <View className="bg-white border border-gray-300 rounded-lg mt-1 shadow-sm">
            {modelSuggestions.map((model, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => selectModel(model)}
                className="px-4 py-3 border-b border-gray-100"
                activeOpacity={0.7}
              >
                <Text className="text-base text-black">{model}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* YEAR AND SEATS FIELDS */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <Input
            label="Year"
            value={vehicleData.annee}
            onChangeText={(text) => {
              setVehicleData({ ...vehicleData, annee: text });
              const yearError = validateYear(text);
              setErrors({ ...errors, annee: yearError });
            }}
            placeholder="2020"
            keyboardType="numeric"
            error={errors.annee}
          />
        </View>
        <View className="flex-1">
          <Input
            label="Seats"
            value={vehicleData.nbPlaces}
            onChangeText={(text) => {
              setVehicleData({ ...vehicleData, nbPlaces: text });
              const seatsError = validateSeats(text);
              setErrors({ ...errors, nbPlaces: seatsError });
            }}
            placeholder="5"
            keyboardType="numeric"
            error={errors.nbPlaces}
          />
        </View>
      </View>

      {/* LICENSE PLATE FIELD WITH AUTO-FORMATTING */}
      <Input
        label="License Plate *"
        value={vehicleData.plaque}
        onChangeText={handleLicensePlateChange}
        placeholder="12345 126 16"
        keyboardType="numeric"
        error={errors.plaque}
        style={{ marginBottom: 16 }}
      />

      {/* COLOR FIELD WITH AUTOCOMPLETE */}
      <View style={{ marginBottom: 24 }}>
        <Input
          label="Color"
          value={vehicleData.couleur}
          onChangeText={handleColorChange}
          placeholder="e.g. Black, White, Red"
          error={errors.couleur}
        />
        
        {colorSuggestions.length > 0 && (
          <View className="bg-white border border-gray-300 rounded-lg mt-1 shadow-sm">
            {colorSuggestions.map((color, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => selectColor(color)}
                className="px-4 py-3 border-b border-gray-100"
                activeOpacity={0.7}
              >
                <Text className="text-base text-black">{color}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <Button
        title="Next Step"
        onPress={handleNextStep}
        variant="primary"
        loading={loading}
        style={{ marginBottom: 0 }}
      />
    </View>
  );

  // Render Step 2: Preferences
  const renderPreferencesForm = () => (
    <View>
      <Text className="text-3xl font-bold text-black mb-2">
        Your Preferences
      </Text>
      <Text className="text-gray-500 mb-6">
        Help passengers know what to expect
      </Text>

      <Text className="text-sm font-semibold text-gray-700 mb-3 uppercase">
        Personal Habits
      </Text>
      <PreferenceItem
        label="I'm a smoker"
        value={preferences.fumeur}
        onToggle={() => togglePreference('fumeur')}
      />
      <PreferenceItem
        label="I'm talkative"
        value={preferences.talkative}
        onToggle={() => togglePreference('talkative')}
      />
      <PreferenceItem
        label="I play radio/music"
        value={preferences.radio_on}
        onToggle={() => togglePreference('radio_on')}
      />

      <Text className="text-sm font-semibold text-gray-700 mb-3 mt-6 uppercase">
        Trip Rules
      </Text>
      <PreferenceItem
        label="Allow smoking in car"
        value={preferences.smoking_allowed}
        onToggle={() => togglePreference('smoking_allowed')}
      />
      <PreferenceItem
        label="Allow pets"
        value={preferences.pets_allowed}
        onToggle={() => togglePreference('pets_allowed')}
      />
      <PreferenceItem
        label="Large car (SUV/Van)"
        value={preferences.car_big}
        onToggle={() => togglePreference('car_big')}
      />

      <Text className="text-sm font-semibold text-gray-700 mb-3 mt-6 uppercase">
        Available Hours
      </Text>
      <PreferenceItem
        label="Morning (6am-12pm)"
        value={preferences.works_morning}
        onToggle={() => togglePreference('works_morning')}
      />
      <PreferenceItem
        label="Afternoon (12pm-6pm)"
        value={preferences.works_afternoon}
        onToggle={() => togglePreference('works_afternoon')}
      />
      <PreferenceItem
        label="Evening (6pm-10pm)"
        value={preferences.works_evening}
        onToggle={() => togglePreference('works_evening')}
      />
      <PreferenceItem
        label="Night (10pm-6am)"
        value={preferences.works_night}
        onToggle={() => togglePreference('works_night')}
      />

      <View className="flex-row gap-3 mt-8">
        <Button
          title="Back"
          onPress={() => setCurrentStep(1)}
          variant="secondary"
          style={{ flex: 1 }}
        />
        <Button
          title="Complete Setup"
          onPress={handleCompleteSetup}
          variant="primary"
          loading={loading}
          style={{ flex: 2 }}
        />
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Complete Your Profile',
          headerBackVisible: false,
        }} 
      />
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