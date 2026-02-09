import { ScrollView, View, Text, Switch, Alert } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../../components/Button';
import Input from '../../components/Input';

export default function DemandeTrajetScreen() {
  const [depart, setDepart] = useState('');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [smoking_ok, setSmokingOk] = useState(false);
  const [pets_ok, setPetsOk] = useState(false);
  const [luggage_large, setLuggageLarge] = useState(false);
  const [quiet_ride, setQuietRide] = useState(false);
  const [radio_ok, setRadioOk] = useState(false);
  const [female_driver_pref, setFemaleDriverPref] = useState(false);


  const handleFindDrivers = async () => {

    // Validation
    if (!depart.trim() || !destination.trim()) {
      Alert.alert('Warning', 'Please fill in departure and destination');
      return;
    }

    try {
      setLoading(true);

      const userData = await AsyncStorage.getItem('user');
      
      if (!userData) {
        Alert.alert('Error', 'You must be logged in');
        router.replace('/auth/passenger/LoginPassengerScreen');
        return;
      }

      const user = JSON.parse(userData);
      const passengerId = user.id;

      console.log('Passager:', passengerId);

      // Construire l'objet preferences
      const preferences = {
        quiet_ride: quiet_ride ? 'yes' : 'no',
        radio_ok: radio_ok ? 'yes' : 'no',
        smoking_ok: smoking_ok ? 'yes' : 'no',
        pets_ok: pets_ok ? 'yes' : 'no',
        luggage_large: luggage_large ? 'yes' : 'no',
        female_driver_pref: female_driver_pref ? 'yes' : 'no'
      };

      // Stocker les infos du trajet
      await AsyncStorage.setItem('tripRequest', JSON.stringify({
        passengerId,
        depart,
        destination,
        preferences
      }));

      // Naviguer
      router.push({
        pathname: './RecommendedDriversScreen',
        params: {
          passengerId,
          depart,
          destination
        }
      });

    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', error.message || 'Something went wrong');

    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 py-8">
        
        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-black mb-2">
            Request a Ride
          </Text>
          <Text className="text-gray-600 text-base">
            Set your travel preferences
          </Text>
        </View>

        {/* Inputs */}
        <Input
          label="Adresse de départ"
          value={depart}
          onChangeText={setDepart}
          placeholder="Entrez l'adresse de départ"
          style={{ marginBottom: 16 }}
        />

        <Input
          label="Adresse de destination"
          value={destination}
          onChangeText={setDestination}
          placeholder="Entrez l'adresse de destination"
          style={{ marginBottom: 24 }}
        />

        {/* Section Préférences */}
        <Text className="text-lg font-semibold text-black mb-4">
          Your Preferences
        </Text>

        {/* Toggles */}
        <View className="flex-row justify-between items-center mb-3 bg-gray-50 px-4 py-3 rounded-xl">
          <Text className="text-sm font-medium">Smoking allowed</Text>
          <Switch
            value={smoking_ok}
            onValueChange={setSmokingOk}
            trackColor={{ false: '#D1D5DB', true: '#000000' }}
            thumbColor={smoking_ok ? '#FFFFFF' : '#F3F4F6'}
          />
        </View>

        <View className="flex-row justify-between items-center mb-3 bg-gray-50 px-4 py-3 rounded-xl">
          <Text className="text-sm font-medium">Pets allowed</Text>
          <Switch
            value={pets_ok}
            onValueChange={setPetsOk}
            trackColor={{ false: '#D1D5DB', true: '#000000' }}
            thumbColor={pets_ok ? '#FFFFFF' : '#F3F4F6'}
          />
        </View>

        <View className="flex-row justify-between items-center mb-3 bg-gray-50 px-4 py-3 rounded-xl">
          <Text className="text-sm font-medium">Large luggage allowed</Text>
          <Switch
            value={luggage_large}
            onValueChange={setLuggageLarge}
            trackColor={{ false: '#D1D5DB', true: '#000000' }}
            thumbColor={luggage_large ? '#FFFFFF' : '#F3F4F6'}
          />
        </View>

        <View className="flex-row justify-between items-center mb-3 bg-gray-50 px-4 py-3 rounded-xl">
          <Text className="text-sm font-medium">Quiet ride</Text>
          <Switch
            value={quiet_ride}
            onValueChange={setQuietRide}
            trackColor={{ false: '#D1D5DB', true: '#000000' }}
            thumbColor={quiet_ride ? '#FFFFFF' : '#F3F4F6'}
          />
        </View>

        <View className="flex-row justify-between items-center mb-3 bg-gray-50 px-4 py-3 rounded-xl">
          <Text className="text-sm font-medium">Radio OK</Text>
          <Switch
            value={radio_ok}
            onValueChange={setRadioOk}
            trackColor={{ false: '#D1D5DB', true: '#000000' }}
            thumbColor={radio_ok ? '#FFFFFF' : '#F3F4F6'}
          />
        </View>

        <View className="flex-row justify-between items-center mb-6 bg-gray-50 px-4 py-3 rounded-xl">
          <Text className="text-sm font-medium">Female driver preferred</Text>
          <Switch
            value={female_driver_pref}
            onValueChange={setFemaleDriverPref}
            trackColor={{ false: '#D1D5DB', true: '#000000' }}
            thumbColor={female_driver_pref ? '#FFFFFF' : '#F3F4F6'}
          />
        </View>

        {/* Button */}
        <Button
          title={loading ? "Recherche..." : "Trouver des conducteurs"}
          onPress={handleFindDrivers}
          variant="primary"
          style={{ marginTop: 8 }}
          disabled={loading}
        />

        {/* Bottom text */}
        <View className="mt-6">
          <Text className="text-center text-gray-500 text-sm">
            We'll find the best drivers for you
          </Text>
        </View>

      </View>
    </ScrollView>
  );
}