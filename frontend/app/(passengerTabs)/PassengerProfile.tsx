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

export default function PassengerProfileScreen() {
  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    try {
      const response = await api.get('/passengers/me');
      setProfile(response.data.data);
    } catch (error) {
      console.error('Erreur passenger profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
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
    params: { role: 'passenger' },
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

            {/* Avatar */}
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

              {/* Nom + Settings */}
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#111', flex: 1 }}>
                  {profile.prenom} {profile.nom}
                </Text>

                {/* Settings */}
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
                  Passenger
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── MY ADDRESS ── */}
        <TouchableOpacity
          onPress={() => router.push('/passenger/SavedPlacesScreen')}
          activeOpacity={0.7}
          style={{
            backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16,
            borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0',
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingVertical: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="location-outline" size={20} color="#111" />
            </View>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#111' }}>My Address</Text>
              <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Manage your saved places</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#888" />
        </TouchableOpacity>

        {/* ── LOGOUT ── */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            marginHorizontal: 16, marginTop: 24, marginBottom: 32, padding: 16,
            backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#FEE2E2',
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#EF4444' }}>Logout</Text>
        </TouchableOpacity>

      </ScrollView>
    </>
  );
}