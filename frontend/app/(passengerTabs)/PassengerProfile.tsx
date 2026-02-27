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
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

  const goToEdit = () => router.push('/passenger/EditProfileScreen');

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
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F5F5F5' }}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {/* ── AVATAR + NOM (centré) ── */}
      <View style={{
        backgroundColor: '#fff', alignItems: 'center',
        paddingTop: 40, paddingBottom: 28,
        borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
      }}>

        {/* Settings en haut à droite */}
        <TouchableOpacity
          onPress={() => Alert.alert('Coming Soon', 'Settings will be available soon')}
          style={{ position: 'absolute', top: 16, right: 16 }}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={22} color="#111" />
        </TouchableOpacity>

        {/* Avatar */}
        <TouchableOpacity onPress={goToEdit} activeOpacity={0.8}>
          {profile.photoUrl ? (
            <Image
              source={{ uri: profile.photoUrl }}
              style={{ width: 100, height: 100, borderRadius: 50 }}
            />
          ) : (
            <View style={{
              width: 100, height: 100, borderRadius: 50, backgroundColor: '#111',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="person" size={50} color="#FFF" />
            </View>
          )}
          <View style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 28, height: 28, borderRadius: 14, backgroundColor: '#222',
            alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
          }}>
            <Ionicons name="camera" size={14} color="#FFF" />
          </View>
        </TouchableOpacity>

        {/* Nom */}
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#111', marginTop: 14 }}>
          {profile.prenom} {profile.nom}
        </Text>

        {/* Badge */}
        <View style={{
          marginTop: 8, backgroundColor: '#111',
          paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Passenger
          </Text>
        </View>
      </View>

      {/* ── INFOS VERTICALES ── */}
      <View style={{
        backgroundColor: '#fff', marginHorizontal: 16, marginTop: 20,
        borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden',
      }}>
        <InfoRow icon="person-outline"   label="First Name" value={profile.prenom} />
        <InfoRow icon="person-outline"   label="Last Name"  value={profile.nom} />
        <InfoRow icon="mail-outline"     label="Email"      value={profile.email} />
        <InfoRow icon="call-outline"     label="Phone"      value={profile.numTel} />
        <InfoRow icon="calendar-outline" label="Age"        value={profile.age?.toString()} last />
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

    </ScrollView>
  );
}

function InfoRow({ icon, label, value, last = false }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: '#F5F5F5',
    }}>
      <Ionicons name={icon} size={18} color="#888" style={{ width: 26 }} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ fontSize: 11, color: '#999', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Text>
        <Text style={{ fontSize: 15, color: '#111', fontWeight: '600', marginTop: 2 }}>
          {value || '—'}
        </Text>
      </View>
    </View>
  );
}