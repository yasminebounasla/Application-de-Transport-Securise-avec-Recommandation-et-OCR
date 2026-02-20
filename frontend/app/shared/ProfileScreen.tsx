import React, { useState, useCallback } from 'react';
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
import { Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';

// ==================== MAIN SCREEN ====================
export default function ProfileScreen() {
  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole]     = useState(null);

  // ✅ FIX: useFocusEffect re-fetches every time the screen comes into focus
  // This ensures preferences are updated after returning from EditProfileScreen
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const userData = JSON.parse(userStr);
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

      // ✅ FIX: Support both flat and nested preferences from API
      // If your /drivers/me returns preferences nested under data.preferences,
      // we read from there. If flat on data, we fall back to data directly.
      const prefs = data.preferences ?? data;

      setProfile({
        ...data,
        allVehicles:     data.vehicules || [],
        talkative:       prefs.talkative,
        radio_on:        prefs.radio_on,
        smoking_allowed: prefs.smoking_allowed,
        pets_allowed:    prefs.pets_allowed,
        car_big:         prefs.car_big,
        works_morning:   prefs.works_morning,
        works_afternoon: prefs.works_afternoon,
        works_evening:   prefs.works_evening,
        works_night:     prefs.works_night,
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
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.clear();
          router.replace('/');
        },
      },
    ]);
  };

  const goToEdit = () => router.push({
    pathname: '/shared/EditprofileScreen',
    params: { role: userRole },
  });

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ color: '#666' }}>No profile data</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'My Profile' }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: '#F5F5F5' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* ── HEADER ── */}
        <View style={{ backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>

            {/* Avatar — tap → edit */}
            <TouchableOpacity onPress={goToEdit} activeOpacity={0.8}>
              {profile.photoUrl ? (
                <Image
                  source={{ uri: profile.photoUrl }}
                  style={{ width: 80, height: 80, borderRadius: 40 }}
                />
              ) : (
                <View style={{
                  width: 80, height: 80, borderRadius: 40, backgroundColor: '#000',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="person" size={40} color="#FFF" />
                </View>
              )}
              <View style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 26, height: 26, borderRadius: 13, backgroundColor: '#222',
                alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
              }}>
                <Ionicons name="camera" size={13} color="#FFF" />
              </View>
            </TouchableOpacity>

            {/* Info */}
            <View style={{ marginLeft: 14, flex: 1 }}>
              {/* Name + star (driver only) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#111', flex: 1 }}>
                  {profile.prenom} {profile.nom}
                </Text>
                {userRole === 'driver' && (
                  <TouchableOpacity
                    onPress={() => router.push('/driver/MyFeedbacksScreen')}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 3,
                      backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
                    }}
                  >
                    <Ionicons name="star" size={13} color="#111" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#111' }}>
                      {(profile.stats?.averageRating || profile.avgRating || 0).toFixed(1)}
                    </Text>
                  </TouchableOpacity>
                )}
                {/* Settings icon */}
                <TouchableOpacity
                  onPress={() => Alert.alert('Coming Soon', 'Settings will be available soon')}
                  style={{
                    width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="settings-outline" size={18} color="#111" />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}>
                <Ionicons name="call-outline" size={13} color="#888" />
                <Text style={{ fontSize: 13, color: '#777' }}>{profile.numTel}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                <Ionicons name="mail-outline" size={13} color="#888" />
                <Text style={{ fontSize: 13, color: '#777' }} numberOfLines={1}>{profile.email}</Text>
              </View>

              <View style={{
                marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#111',
                paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>
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

        {/* ── PREFERENCES ── */}
        <View style={{
          backgroundColor: '#fff', marginHorizontal: 16, marginVertical: 8,
          borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden',
        }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#111' }}>Preferences</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            {userRole === 'driver' ? (
              <DriverPreferencesContent profile={profile} />
            ) : (
              <PassengerPreferencesContent profile={profile} />
            )}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </>
  );
}

// ==================== DRIVER STATS ====================
function DriverStats({ profile }) {
  const stats          = profile.stats || {};
  const totalRides     = stats.totalRides     || 0;
  const completedRides = stats.completedRides || 0;

  return (
    <View style={{
      backgroundColor: '#fff', padding: 16, margin: 16,
      borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0',
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="car" size={24} color="#000" />
            <Text style={{ fontSize: 24, fontWeight: '800', marginLeft: 6 }}>{totalRides}</Text>
          </View>
          <Text style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Total Rides</Text>
        </View>
        <View style={{ width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 8 }} />
        <View style={{ alignItems: 'center', flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={{ fontSize: 24, fontWeight: '800', marginLeft: 6 }}>{completedRides}</Text>
          </View>
          <Text style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Completed</Text>
        </View>
      </View>
    </View>
  );
}

// ==================== PASSENGER STATS ====================
function PassengerStats({ profile }) {
  const totalRides = profile.stats?.totalRides || 0;

  return (
    <View style={{
      backgroundColor: '#fff', padding: 16, margin: 16,
      borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0',
    }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="car" size={24} color="#000" />
            <Text style={{ fontSize: 24, fontWeight: '800', marginLeft: 6 }}>{totalRides}</Text>
          </View>
          <Text style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Rides Taken</Text>
        </View>
        <View style={{ width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 8 }} />
        <TouchableOpacity
          style={{ alignItems: 'center', flex: 1 }}
          onPress={() => router.push('/passenger/SavedPlacesScreen')}
          activeOpacity={0.7}
        >
          <Ionicons name="location-outline" size={24} color="#000" />
          <Text style={{ color: '#888', fontSize: 13, marginTop: 4 }}>My Address</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ==================== DRIVER PREFERENCES ====================
function DriverPreferencesContent({ profile }) {
  const preferences = [
    { icon: 'chatbubbles-outline',   label: 'Talkative',       value: profile.talkative },
    { icon: 'musical-notes-outline', label: 'Radio On',         value: profile.radio_on },
    { icon: 'flame-outline',         label: 'Smoking Allowed',  value: profile.smoking_allowed },
    { icon: 'paw-outline',           label: 'Pets Allowed',     value: profile.pets_allowed },
    { icon: 'car-sport-outline',     label: 'Large Car',        value: profile.car_big },
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
      <Text style={{
        fontSize: 12, fontWeight: '700', color: '#999',
        marginTop: 14, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
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
    { icon: 'flame-outline',       label: 'Smoking OK',    value: profile.smoking_ok },
    { icon: 'paw-outline',         label: 'Pets OK',       value: profile.pets_ok },
    { icon: 'briefcase-outline',   label: 'Large Luggage', value: profile.luggage_large },
  ];
  return <>{preferences.map((pref, i) => <PreferenceRow key={i} {...pref} />)}</>;
}

// ==================== PREFERENCE ROW ====================
function PreferenceRow({ icon, label, value }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Ionicons name={icon} size={18} color="#666" />
        <Text style={{ marginLeft: 10, fontSize: 14, color: '#374151' }}>{label}</Text>
      </View>
      <View style={{
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
        backgroundColor: value ? '#D1FAE5' : '#F3F4F6',
      }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: value ? '#065F46' : '#6B7280' }}>
          {value ? 'YES' : 'NO'}
        </Text>
      </View>
    </View>
  );
}