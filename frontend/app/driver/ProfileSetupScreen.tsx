import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Input from '../../components/Input';
import Button from '../../components/Button';
import api from '../../services/api';

// PreferenceItem component moved outside
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

  // Errors state - ALL FIELDS
  const [errors, setErrors] = useState({
    marque: '',
    modele: '',
    annee: '',
    nbPlaces: '',
    plaque: '',
    couleur: '',
  });

  // Toggle preference
  const togglePreference = (key) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Validate Step 1 (Vehicle) - COMPLETE VERSION
  const validateVehicle = () => {
    const newErrors = {
      marque: '',
      modele: '',
      annee: '',
      nbPlaces: '',
      plaque: '',
      couleur: '',
    };
    
    // Brand validation - REQUIRED, min 2 chars, letters only
    if (!vehicleData.marque || vehicleData.marque.trim() === '') {
      newErrors.marque = 'Brand is required';
    } else if (vehicleData.marque.trim().length < 2) {
      newErrors.marque = 'Brand must be at least 2 characters';
    } else if (!/^[a-zA-Z\s-]+$/.test(vehicleData.marque)) {
      newErrors.marque = 'Brand must contain only letters';
    }
    
    // Model validation - Optional, but if provided, min 1 char, alphanumeric
    if (vehicleData.modele && vehicleData.modele.trim() !== '') {
      if (vehicleData.modele.trim().length < 1) {
        newErrors.modele = 'Model must be at least 1 character';
      } else if (!/^[a-zA-Z0-9\s-]+$/.test(vehicleData.modele)) {
        newErrors.modele = 'Model must contain only letters and numbers';
      }
    }
    
    // Year validation - Optional, but if provided, must be valid
    if (vehicleData.annee && vehicleData.annee.trim() !== '') {
      const yearNum = Number(vehicleData.annee);
      const currentYear = new Date().getFullYear();
      if (isNaN(yearNum)) {
        newErrors.annee = 'Year must be a number';
      } else if (yearNum < 1900 || yearNum > currentYear + 1) {
        newErrors.annee = `Year must be between 1900 and ${currentYear + 1}`;
      }
    }
    
    // Seats validation - Optional, but if provided, must be valid
    if (vehicleData.nbPlaces && vehicleData.nbPlaces.trim() !== '') {
      const seatsNum = Number(vehicleData.nbPlaces);
      if (isNaN(seatsNum)) {
        newErrors.nbPlaces = 'Seats must be a number';
      } else if (seatsNum < 1 || seatsNum > 9) {
        newErrors.nbPlaces = 'Seats must be between 1 and 9';
      }
    }

    // License Plate validation - Optional, but if provided, check format
    if (vehicleData.plaque && vehicleData.plaque.trim() !== '') {
      const cleanPlate = vehicleData.plaque.trim();
      if (cleanPlate.length < 3) {
        newErrors.plaque = 'License plate too short';
      } else if (cleanPlate.length > 15) {
        newErrors.plaque = 'License plate too long';
      } else if (!/^[a-zA-Z0-9\s-]+$/.test(cleanPlate)) {
        newErrors.plaque = 'Invalid characters in license plate';
      }
    }

    // Color validation - Optional, but if provided, letters only
    if (vehicleData.couleur && vehicleData.couleur.trim() !== '') {
      if (vehicleData.couleur.trim().length < 3) {
        newErrors.couleur = 'Color must be at least 3 characters';
      } else if (!/^[a-zA-Z\s-]+$/.test(vehicleData.couleur)) {
        newErrors.couleur = 'Color must contain only letters';
      }
    }

    setErrors(newErrors);
    
    // Return true if no errors
    return !newErrors.marque && !newErrors.modele && !newErrors.annee && 
           !newErrors.nbPlaces && !newErrors.plaque && !newErrors.couleur;
  };

  // Handle Next Step
  const handleNextStep = async () => {
    if (!validateVehicle()) {
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

  // Handle Complete Setup
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
            onPress: () => router.replace('/driver/HomeScreen'),
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

  // Render Step Indicator
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

      <Input
        label="Brand *"
        value={vehicleData.marque}
        onChangeText={(text) => setVehicleData({ ...vehicleData, marque: text })}
        placeholder="e.g. Peugeot"
        error={errors.marque}
        style={{ marginBottom: 16 }}
      />

      <Input
        label="Model"
        value={vehicleData.modele}
        onChangeText={(text) => setVehicleData({ ...vehicleData, modele: text })}
        placeholder="e.g. 308"
        error={errors.modele}
        style={{ marginBottom: 16 }}
      />

      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <Input
            label="Year"
            value={vehicleData.annee}
            onChangeText={(text) => setVehicleData({ ...vehicleData, annee: text })}
            placeholder="2020"
            keyboardType="numeric"
            error={errors.annee}
          />
        </View>
        <View className="flex-1">
          <Input
            label="Seats"
            value={vehicleData.nbPlaces}
            onChangeText={(text) => setVehicleData({ ...vehicleData, nbPlaces: text })}
            placeholder="5"
            keyboardType="numeric"
            error={errors.nbPlaces}
          />
        </View>
      </View>

      <Input
        label="License Plate"
        value={vehicleData.plaque}
        onChangeText={(text) => setVehicleData({ ...vehicleData, plaque: text })}
        placeholder="1234-ABC-56"
        error={errors.plaque}
        style={{ marginBottom: 16 }}
      />

      <Input
        label="Color"
        value={vehicleData.couleur}
        onChangeText={(text) => setVehicleData({ ...vehicleData, couleur: text })}
        placeholder="Black"
        error={errors.couleur}
        style={{ marginBottom: 24 }}
      />

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