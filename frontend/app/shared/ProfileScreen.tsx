import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
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
  const [user, setUser]             = useState(null);
  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole]     = useState(null);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const userData = JSON.parse(userStr);
        setUser(userData);
        setUserRole(userData.role);
        if (userData.role === 'driver')         await loadDriverProfile();
        else if (userData.role === 'passenger') await loadPassengerProfile();
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
      setProfile({
        ...data,
        allVehicles:     data.vehicules || [],
        fumeur:          data.preferences?.fumeur,
        talkative:       data.preferences?.talkative,
        radio_on:        data.preferences?.radio_on,
        smoking_allowed: data.preferences?.smoking_allowed,
        pets_allowed:    data.preferences?.pets_allowed,
        car_big:         data.preferences?.car_big,
        works_morning:   data.preferences?.works_morning,
        works_afternoon: data.preferences?.works_afternoon,
        works_evening:   data.preferences?.works_evening,
        works_night:     data.preferences?.works_night,
      });
    } catch (error) { console.error('Erreur driver profile:', error); throw error; }
  };

  const loadPassengerProfile = async () => {
    try {
      const response = await api.get('/passengers/me');
      setProfile(response.data.data);
    } catch (error) { console.error('Erreur passenger profile:', error); throw error; }
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
        text: 'Logout', style: 'destructive',
        onPress: async () => { await AsyncStorage.clear(); router.replace('/'); },
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
        {/* ── HEADER ── */}
        <View className="bg-white p-5 border-b border-gray-200">
          <View className="flex-row items-center">

            {/* Avatar — tap to edit photo */}
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: userRole === 'driver'
                    ? '/shared/EditprofileScreen'
                    : '/shared/EditprofileScreen',
                  params: { role: userRole },
                })
              }
              activeOpacity={0.8}
            >
              {profile.photoUrl ? (
                <Image
                  source={{ uri: profile.photoUrl }}
                  style={{ width: 80, height: 80, borderRadius: 40 }}
                />
              ) : (
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={40} color="#FFF" />
                </View>
              )}
              {/* Camera badge */}
              <View style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 26, height: 26, borderRadius: 13,
                backgroundColor: '#222',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: '#fff',
              }}>
                <Ionicons name="camera" size={13} color="#FFF" />
              </View>
            </TouchableOpacity>

            {/* Info */}
            <View className="ml-4 flex-1">

              {/* Name + star (driver only) */}
              <View className="flex-row items-center flex-wrap gap-2">
                <Text className="text-xl font-bold text-black">
                  {profile.prenom} {profile.nom}
                </Text>
                {userRole === 'driver' && (
                  <TouchableOpacity
                    onPress={() => router.push('/driver/MyFeedbacksScreen')}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                  >
                    <Ionicons name="star" size={16} color="#000" />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#000' }}>
                      {(profile.stats?.averageRating || 0).toFixed(1)}
                    </Text>
                  </TouchableOpacity>
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

              {/* Role badge */}
              <View className="mt-2 self-start px-3 py-1 bg-gray-100 rounded-full">
                <Text className="text-xs font-semibold text-gray-700 uppercase">
                  {userRole === 'driver' ? 'Driver' : 'Passenger'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── STATS ── */}
        {userRole === 'driver' ? (
          <DriverStats profile={profile} />
        ) : (
          <PassengerStats profile={profile} />
        )}

        {/* ── PREFERENCES — always visible, no collapse ── */}
        <View className="bg-white mx-4 my-2 rounded-xl border border-gray-200 overflow-hidden">
          <View className="px-4 pt-4 pb-2">
            <Text className="text-lg font-bold text-black">Preferences</Text>
          </View>
          <View className="px-4 pb-4">
            {userRole === 'driver' ? (
              <DriverPreferencesContent profile={profile} />
            ) : (
              <PassengerPreferencesContent profile={profile} />
            )}
          </View>
        </View>

        {/* ── ACTIONS ── */}
        <View className="p-4 space-y-3">

          {/* Edit Profile */}
          <TouchableOpacity
            className="bg-white p-4 rounded-xl flex-row items-center justify-between border border-gray-200"
            onPress={() =>
              router.push({
                pathname: '/shared/EditprofileScreen',
                params: { role: userRole },
              })
            }
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <Ionicons name="create-outline" size={24} color="#000" />
              <Text className="ml-3 text-base font-semibold">Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          {/* Settings */}
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

          {/* Logout */}
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
// My Reviews removed — only star next to name now
function DriverStats({ profile }) {
  const stats    = profile.stats || {};
  const totalRides     = stats.totalRides     || 0;
  const completedRides = stats.completedRides || 0;

  return (
    <View className="bg-white p-4 m-4 rounded-xl border border-gray-200">
      <View className="flex-row justify-around">
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
  const stats          = profile.stats || {};
  const totalRides     = stats.totalRides     || 0;

  return (
    <View className="bg-white p-4 m-4 rounded-xl border border-gray-200">
      <View className="flex-row justify-around">
        <View className="items-center flex-1">
          <View className="flex-row items-center">
            <Ionicons name="car" size={24} color="#000" />
            <Text className="text-2xl font-bold ml-2">{totalRides}</Text>
          </View>
          <Text className="text-gray-600 text-sm mt-1">Rides Taken</Text>
        </View>
        <View className="w-px bg-gray-200" />
        {/* My Address */}
        <TouchableOpacity
          className="items-center flex-1"
          onPress={() => router.push('/passenger/SavedPlacesScreen')}
          activeOpacity={0.7}
        >
          <Ionicons name="location-outline" size={24} color="#000" />
          <Text className="text-gray-600 text-sm mt-1">My Address</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ==================== DRIVER PREFERENCES ====================
function DriverPreferencesContent({ profile }) {
  const preferences = [
    { icon: 'chatbubbles',   label: 'Talkative',       value: profile.talkative },
    { icon: 'musical-notes', label: 'Radio On',         value: profile.radio_on },
    { icon: 'flame',         label: 'Smoking Allowed',  value: profile.smoking_allowed },
    { icon: 'paw',           label: 'Pets Allowed',     value: profile.pets_allowed },
    { icon: 'car-sport',     label: 'Large Car',        value: profile.car_big },
  ];
  const workingHours = [
    { icon: 'sunny-outline',        label: 'Morning (6am–12pm)',   value: profile.works_morning },
    { icon: 'partly-sunny-outline', label: 'Afternoon (12pm–6pm)', value: profile.works_afternoon },
    { icon: 'moon-outline',         label: 'Evening (6pm–10pm)',   value: profile.works_evening },
    { icon: 'cloudy-night-outline', label: 'Night (10pm–6am)',     value: profile.works_night },
  ];
  return (
    <>
      {preferences.map((pref, i) => <PreferenceRow key={i} {...pref} />)}
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#555', marginTop: 14, marginBottom: 4 }}>
        Working Hours
      </Text>
      {workingHours.map((hour, i) => <PreferenceRow key={i} {...hour} />)}
    </>
  );
}

// ==================== PASSENGER PREFERENCES ====================
function PassengerPreferencesContent({ profile }) {
  const preferences = [
    { icon: 'volume-mute-outline', label: 'Quiet Ride',   value: profile.quiet_ride },
    { icon: 'musical-notes',       label: 'Radio OK',      value: profile.radio_ok },
    { icon: 'flame',               label: 'Smoking OK',    value: profile.smoking_ok },
    { icon: 'paw',                 label: 'Pets OK',       value: profile.pets_ok },
    { icon: 'briefcase-outline',   label: 'Large Luggage', value: profile.luggage_large },
  ];
  return <>{preferences.map((pref, i) => <PreferenceRow key={i} {...pref} />)}</>;
}

// ==================== PREFERENCE ROW ====================
function PreferenceRow({ icon, label, value }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Ionicons name={icon} size={18} color="#666" />
        <Text style={{ marginLeft: 10, fontSize: 14, color: '#374151' }}>{label}</Text>
      </View>
      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: value ? '#D1FAE5' : '#F3F4F6' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: value ? '#065F46' : '#6B7280' }}>
          {value ? 'YES' : 'NO'}
        </Text>
      </View>
    </View>
  );
}