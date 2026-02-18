import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';

// ==================== COLLAPSIBLE SECTION ====================
function CollapsibleSection({ title, icon, children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View className="bg-white m-4 rounded-xl border border-gray-200 overflow-hidden">
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.7}
        className="flex-row items-center justify-between p-4"
      >
        <View className="flex-row items-center">
          <Text className="text-lg">{icon}</Text>
          <Text className="text-lg font-bold text-black ml-2">{title}</Text>
        </View>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
      </TouchableOpacity>

      {isOpen && (
        <View className="border-t border-gray-100 px-4 pb-4 pt-2">
          {children}
        </View>
      )}
    </View>
  );
}

// ==================== MAIN SCREEN ====================
export default function ProfileScreen() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const userData = JSON.parse(userStr);
        setUser(userData);
        setUserRole(userData.role);

        if (userData.role === 'driver') {
          await loadDriverProfile();
        } else if (userData.role === 'passenger') {
          await loadPassengerProfile();
        }
      }
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadDriverProfile = async () => {
    try {
      const response = await api.get('/drivers/me');
      const data = response.data.data;

      // /drivers/me already returns vehicules + preferences nested
      setProfile({
        ...data,
        allVehicles: data.vehicules || [],
        // preferences are nested under data.preferences
        fumeur: data.preferences?.fumeur,
        talkative: data.preferences?.talkative,
        radio_on: data.preferences?.radio_on,
        smoking_allowed: data.preferences?.smoking_allowed,
        pets_allowed: data.preferences?.pets_allowed,
        car_big: data.preferences?.car_big,
        works_morning: data.preferences?.works_morning,
        works_afternoon: data.preferences?.works_afternoon,
        works_evening: data.preferences?.works_evening,
        works_night: data.preferences?.works_night,
      });
    } catch (error) {
      console.error('Erreur driver profile:', error);
      throw error;
    }
  };

  const loadPassengerProfile = async () => {
    try {
      const response = await api.get('/passengers/me');
      setProfile(response.data.data);
    } catch (error) {
      console.error('Erreur passenger profile:', error);
      throw error;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.clear();
          router.replace('/');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#000" />
        <Text className="mt-4 text-gray-600">Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-gray-600">No profile data</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Profile',
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#000" />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-gray-50"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header - horizontal layout */}
        <View className="bg-white p-5 border-b border-gray-200">
          <View className="flex-row items-center">
            {/* Avatar - tappable to edit */}
            <TouchableOpacity
              onPress={() => Alert.alert('Coming Soon', 'Edit profile feature will be available soon')}
              activeOpacity={0.8}
            >
              <View className="w-20 h-20 rounded-full bg-black items-center justify-center">
                <Ionicons name="person" size={40} color="#FFF" />
              </View>
              <View className="absolute bottom-0 right-0 w-6 h-6 bg-gray-700 rounded-full items-center justify-center">
                <Ionicons name="pencil" size={12} color="#FFF" />
              </View>
            </TouchableOpacity>

            {/* Info */}
            <View className="ml-4 flex-1">
              {/* Name + Rating */}
              <View className="flex-row items-center flex-wrap">
                <Text className="text-xl font-bold text-black mr-2">
                  {profile.prenom} {profile.nom}
                </Text>
                {userRole === 'driver' && (
                  <View className="flex-row items-center bg-gray-100 px-2 py-1 rounded-full">
                    <Ionicons name="star" size={13} color="#FFA500" />
                    <Text className="text-sm font-bold text-gray-800 ml-1">
                      {(profile.stats?.avgRating || 0).toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>

              <View className="flex-row items-center mt-1">
                <Ionicons name="call-outline" size={14} color="#666" />
                <Text className="text-gray-600 ml-1 text-sm">{profile.numTel}</Text>
              </View>

              <View className="flex-row items-center mt-1">
                <Ionicons name="mail-outline" size={14} color="#666" />
                <Text className="text-gray-600 ml-1 text-sm" numberOfLines={1}>{profile.email}</Text>
              </View>

              {profile.age && (
                <View className="flex-row items-center mt-1">
                  <Ionicons name="calendar-outline" size={14} color="#666" />
                  <Text className="text-gray-600 ml-1 text-sm">{profile.age} years old</Text>
                </View>
              )}

              <View className="mt-2 self-start px-3 py-1 bg-gray-100 rounded-full">
                <Text className="text-xs font-semibold text-gray-700 uppercase">
                  {userRole === 'driver' ? 'Driver' : 'Passenger'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats */}
        {userRole === 'driver' ? (
          <DriverStats profile={profile} />
        ) : (
          <PassengerStats profile={profile} />
        )}

        {/* Vehicle Section - Driver only, always shown, collapsible */}
        {userRole === 'driver' && (
          <CollapsibleSection title="My Vehicle" icon="🚗">
            <VehicleContent vehicles={profile.allVehicles} />
          </CollapsibleSection>
        )}

        {/* Preferences Section - collapsible */}
        <CollapsibleSection title="Preferences" icon="⚙️">
          {userRole === 'driver' ? (
            <DriverPreferencesContent profile={profile} />
          ) : (
            <PassengerPreferencesContent profile={profile} />
          )}
        </CollapsibleSection>

        {/* Actions */}
        <View className="p-4 space-y-3">
          {userRole === 'driver' && (
            <TouchableOpacity
              className="bg-white p-4 rounded-xl flex-row items-center justify-between border border-gray-200"
              onPress={() => router.push('/driver/MyFeedbacksScreen')}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <Ionicons name="star-outline" size={24} color="#000" />
                <Text className="ml-3 text-base font-semibold">My Reviews</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className="bg-white p-4 rounded-xl flex-row items-center justify-between border border-gray-200"
            onPress={() => Alert.alert('Coming Soon', 'Settings feature will be available soon')}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <Ionicons name="settings-outline" size={24} color="#000" />
              <Text className="ml-3 text-base font-semibold">Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-red-50 p-4 rounded-xl flex-row items-center justify-center border border-red-200 mt-6"
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={24} color="#DC2626" />
            <Text className="ml-3 text-base font-semibold text-red-600">Logout</Text>
          </TouchableOpacity>
        </View>

        <View className="h-8" />
      </ScrollView>
    </>
  );
}

// ==================== DRIVER STATS ====================
function DriverStats({ profile }) {
  const stats = profile.stats || {};
  const rating = stats.averageRating || 0;
  const totalRides = stats.totalRides || 0;
  const completedRides = stats.completedRides || 0;
  const totalReviews = stats.totalReviews || 0;

  return (
    <View className="bg-white p-4 m-4 rounded-xl border border-gray-200">
      <Text className="text-lg font-bold text-black mb-4">Statistics</Text>
      <View className="flex-row justify-between">
        <View className="items-center flex-1">
          <View className="flex-row items-center">
            <Ionicons name="star" size={24} color="#FFA500" />
            <Text className="text-2xl font-bold ml-2">{rating.toFixed(1)}</Text>
          </View>
          <Text className="text-gray-600 text-sm mt-1">Rating</Text>
          <Text className="text-gray-500 text-xs">({totalReviews} reviews)</Text>
        </View>
        <View className="w-px bg-gray-200" />
        <View className="items-center flex-1">
          <View className="flex-row items-center">
            <Ionicons name="car" size={24} color="#000" />
            <Text className="text-2xl font-bold ml-2">{totalRides}</Text>
          </View>
          <Text className="text-gray-600 text-sm mt-1">Total Rides</Text>
        </View>
        <View className="w-px bg-gray-200" />
        <View className="items-center flex-1">
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text className="text-2xl font-bold ml-2">{completedRides}</Text>
          </View>
          <Text className="text-gray-600 text-sm mt-1">Completed</Text>
        </View>
      </View>
    </View>
  );
}

// ==================== PASSENGER STATS ====================
function PassengerStats({ profile }) {
  const stats = profile.stats || {};
  const totalRides = stats.totalRides || 0;
  const completedRides = stats.completedRides || 0;

  return (
    <View className="bg-white p-4 m-4 rounded-xl border border-gray-200">
      <Text className="text-lg font-bold text-black mb-4">Statistics</Text>
      <View className="flex-row justify-around">
        <View className="items-center flex-1">
          <View className="flex-row items-center">
            <Ionicons name="car" size={24} color="#000" />
            <Text className="text-2xl font-bold ml-2">{totalRides}</Text>
          </View>
          <Text className="text-gray-600 text-sm mt-1">Rides Taken</Text>
        </View>
        <View className="w-px bg-gray-200" />
        <View className="items-center flex-1">
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text className="text-2xl font-bold ml-2">{completedRides}</Text>
          </View>
          <Text className="text-gray-600 text-sm mt-1">Completed</Text>
        </View>
      </View>
    </View>
  );
}

// ==================== VEHICLE CONTENT ====================
function VehicleContent({ vehicles }) {
  if (!vehicles || vehicles.length === 0) {
    return (
      <View className="items-center py-6">
        <Ionicons name="car-outline" size={48} color="#ccc" />
        <Text className="text-gray-400 mt-2 text-base">No vehicle registered</Text>
      </View>
    );
  }

  return (
    <>
      {vehicles.map((vehicle, index) => (
        <View key={vehicle.id || index} className="bg-gray-50 p-4 rounded-lg mb-3">
          <Text className="text-xl font-bold text-black">
            {vehicle.marque} {vehicle.modele}
          </Text>
          <View className="flex-row flex-wrap mt-3 gap-2">
            {vehicle.annee && (
              <View className="bg-white px-3 py-2 rounded-full border border-gray-200">
                <Text className="text-sm text-gray-700">📅 {vehicle.annee}</Text>
              </View>
            )}
            {vehicle.nbPlaces && (
              <View className="bg-white px-3 py-2 rounded-full border border-gray-200">
                <Text className="text-sm text-gray-700">👥 {vehicle.nbPlaces} seats</Text>
              </View>
            )}
            {vehicle.couleur && (
              <View className="bg-white px-3 py-2 rounded-full border border-gray-200">
                <Text className="text-sm text-gray-700">🎨 {vehicle.couleur}</Text>
              </View>
            )}
            {vehicle.plaque && (
              <View className="bg-white px-3 py-2 rounded-full border border-gray-200">
                <Text className="text-sm font-mono text-gray-700">🔢 {vehicle.plaque}</Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </>
  );
}

// ==================== DRIVER PREFERENCES ====================
function DriverPreferencesContent({ profile }) {
  const preferences = [
    { icon: 'ban', label: 'Smoker', value: profile.fumeur },
    { icon: 'chatbubbles', label: 'Talkative', value: profile.talkative },
    { icon: 'musical-notes', label: 'Radio On', value: profile.radio_on },
    { icon: 'ban', label: 'Smoking Allowed', value: profile.smoking_allowed },
    { icon: 'paw', label: 'Pets Allowed', value: profile.pets_allowed },
    { icon: 'car-sport', label: 'Large Car', value: profile.car_big },
  ];

  const workingHours = [
    { icon: 'sunny', label: 'Morning (6am-12pm)', value: profile.works_morning },
    { icon: 'partly-sunny', label: 'Afternoon (12pm-6pm)', value: profile.works_afternoon },
    { icon: 'moon', label: 'Evening (6pm-10pm)', value: profile.works_evening },
    { icon: 'moon-outline', label: 'Night (10pm-6am)', value: profile.works_night },
  ];

  return (
    <>
      {preferences.map((pref, index) => (
        <PreferenceRow key={index} {...pref} />
      ))}
      <Text className="text-base font-semibold text-gray-700 mt-4 mb-1">Working Hours</Text>
      {workingHours.map((hour, index) => (
        <PreferenceRow key={index} {...hour} />
      ))}
    </>
  );
}

// ==================== PASSENGER PREFERENCES ====================
function PassengerPreferencesContent({ profile }) {
  const preferences = [
    { icon: 'volume-mute', label: 'Quiet Ride', value: profile.quiet_ride },
    { icon: 'musical-notes', label: 'Radio OK', value: profile.radio_ok },
    { icon: 'ban', label: 'No Smoking', value: !profile.smoking_ok },
    { icon: 'paw', label: 'Pets OK', value: profile.pets_ok },
    { icon: 'briefcase', label: 'Large Luggage', value: profile.luggage_large },
  ];

  return (
    <>
      {preferences.map((pref, index) => (
        <PreferenceRow key={index} {...pref} />
      ))}
    </>
  );
}

// ==================== PREFERENCE ROW ====================
function PreferenceRow({ icon, label, value }) {
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
      <View className="flex-row items-center flex-1">
        <Ionicons name={icon} size={20} color="#666" />
        <Text className="ml-3 text-base text-gray-700">{label}</Text>
      </View>
      <View className={`px-3 py-1 rounded-full ${value ? 'bg-green-100' : 'bg-gray-100'}`}>
        <Text className={`text-xs font-semibold ${value ? 'text-green-700' : 'text-gray-600'}`}>
          {value ? 'YES' : 'NO'}
        </Text>
      </View>
    </View>
  );
}