import { ScrollView, View, Text, Switch } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import Button from '../../components/Button';
import Input from '../../components/Input';

export default function DemandeTrajetScreen() {
  const [depart, setDepart] = useState('');
  const [destination, setDestination] = useState('');
  const [smoking_ok, setSmokingOk] = useState(false);
  const [pets_ok, setPetsOk] = useState(false);
  const [luggage_large, setLuggageLarge] = useState(false);
  const [quiet_ride, setQuietRide] = useState(false);
  const [radio_ok, setRadioOk] = useState(false);
  const [female_driver_pref, setFemaleDriverPref] = useState(false);

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 py-8">
        
        {/* Header - même style que auth */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-black mb-2">
            Demande Trajet
          </Text>
          <Text className="text-gray-600 text-base">
            Configurez vos préférences de voyage
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
          Vos préférences
        </Text>

        {/* Toggles - plus compacts */}
        <View className="flex-row justify-between items-center mb-3 bg-gray-50 px-4 py-3 rounded-xl">
          <Text className="text-sm font-medium">Fumeur</Text>
          <Switch
            value={smoking_ok}
            onValueChange={setSmokingOk}
            trackColor={{ false: '#D1D5DB', true: '#000000' }}
            thumbColor={smoking_ok ? '#FFFFFF' : '#F3F4F6'}
          />
        </View>

        <View className="flex-row justify-between items-center mb-3 bg-gray-50 px-4 py-3 rounded-xl">
          <Text className="text-sm font-medium">Animaux acceptés</Text>
          <Switch
            value={pets_ok}
            onValueChange={setPetsOk}
            trackColor={{ false: '#D1D5DB', true: '#000000' }}
            thumbColor={pets_ok ? '#FFFFFF' : '#F3F4F6'}
          />
        </View>

        <View className="flex-row justify-between items-center mb-3 bg-gray-50 px-4 py-3 rounded-xl">
          <Text className="text-sm font-medium">Gros bagages</Text>
          <Switch
            value={luggage_large}
            onValueChange={setLuggageLarge}
            trackColor={{ false: '#D1D5DB', true: '#000000' }}
            thumbColor={luggage_large ? '#FFFFFF' : '#F3F4F6'}
          />
        </View>

        <View className="flex-row justify-between items-center mb-3 bg-gray-50 px-4 py-3 rounded-xl">
          <Text className="text-sm font-medium">Trajet silencieux</Text>
          <Switch
            value={quiet_ride}
            onValueChange={setQuietRide}
            trackColor={{ false: '#D1D5DB', true: '#000000' }}
            thumbColor={quiet_ride ? '#FFFFFF' : '#F3F4F6'}
          />
        </View>

        <View className="flex-row justify-between items-center mb-3 bg-gray-50 px-4 py-3 rounded-xl">
          <Text className="text-sm font-medium">Radio/Musique OK</Text>
          <Switch
            value={radio_ok}
            onValueChange={setRadioOk}
            trackColor={{ false: '#D1D5DB', true: '#000000' }}
            thumbColor={radio_ok ? '#FFFFFF' : '#F3F4F6'}
          />
        </View>

        <View className="flex-row justify-between items-center mb-6 bg-gray-50 px-4 py-3 rounded-xl">
          <Text className="text-sm font-medium">Préférence conductrice</Text>
          <Switch
            value={female_driver_pref}
            onValueChange={setFemaleDriverPref}
            trackColor={{ false: '#D1D5DB', true: '#000000' }}
            thumbColor={female_driver_pref ? '#FFFFFF' : '#F3F4F6'}
          />
        </View>

        {/* Button */}
        <Button
          title="Trouver des conducteurs"
          onPress={() => router.push('./RecommendedDriversScreen')}
          variant="primary"
          style={{ marginTop: 8 }}
        />

        {/* Bottom text - même style que auth */}
        <View className="mt-6">
          <Text className="text-center text-gray-500 text-sm">
            Nous trouverons les meilleurs conducteurs pour vous
          </Text>
        </View>

      </View>
    </ScrollView>
  );
}