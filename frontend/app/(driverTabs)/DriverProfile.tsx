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

export default function DriverProfileScreen() {
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
      const response = await api.get('/drivers/me');
      const data = response.data.data;
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

  const goToEdit = () => router.push({
    pathname: '../shared/EditprofileScreen',
    params: { role: 'driver' },
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

        {/* Nom + ⭐ Rating */}
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#111', marginTop: 14 }}>
          {profile.prenom} {profile.nom}
        </Text>

        {/* ⭐ Rating */}
        <TouchableOpacity
          onPress={() => router.push('../driver/MyFeedbacksScreen')}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: '#FEF9C3', paddingHorizontal: 12, paddingVertical: 5,
            borderRadius: 20, marginTop: 8,
          }}
        >
          <Ionicons name="star" size={14} color="#CA8A04" />
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#CA8A04' }}>
            {(profile.stats?.averageRating || profile.avgRating || 0).toFixed(1)}
          </Text>
          <Text style={{ fontSize: 12, color: '#CA8A04' }}>· See reviews</Text>
        </TouchableOpacity>

        {/* Badge */}
        <View style={{
          marginTop: 8, backgroundColor: '#111',
          paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Driver
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
        <InfoRow icon="calendar-outline" label="Age"        value={profile.age?.toString()} />
        <InfoRow icon="male-female-outline" label="Gender"  value={profile.sexe} last />
      </View>

      {/* ── VÉHICULES ── */}
      {profile.allVehicles.length > 0 && (
        <View style={{
          backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16,
          borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden',
        }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#111' }}>My Vehicles</Text>
          </View>
          {profile.allVehicles.map((v, i) => (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 16, paddingVertical: 12,
              borderTopWidth: 1, borderTopColor: '#F5F5F5',
            }}>
              <Ionicons name="car-outline" size={20} color="#666" />
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111' }}>
                  {v.marque} {v.modele}
                </Text>
                <Text style={{ fontSize: 12, color: '#888' }}>
                  {v.annee} · {v.couleur} · {v.nbPlaces} places · {v.plaque}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── PRÉFÉRENCES ── */}
      <View style={{
        backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16,
        borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden',
      }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#111' }}>Preferences</Text>
        </View>
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          {[
            { icon: 'chatbubbles-outline',   label: 'Talkative',      value: profile.talkative },
            { icon: 'musical-notes-outline', label: 'Radio On',        value: profile.radio_on },
            { icon: 'flame-outline',         label: 'Smoking Allowed', value: profile.smoking_allowed },
            { icon: 'paw-outline',           label: 'Pets Allowed',    value: profile.pets_allowed },
            { icon: 'car-sport-outline',     label: 'Large Car',       value: profile.car_big },
          ].map((pref, i) => <PreferenceRow key={i} {...pref} />)}

          <Text style={{
            fontSize: 12, fontWeight: '700', color: '#999',
            marginTop: 14, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            Working Hours
          </Text>

          {[
            { icon: 'sunny-outline',        label: 'Morning (6am–12pm)',   value: profile.works_morning },
            { icon: 'partly-sunny-outline', label: 'Afternoon (12pm–6pm)', value: profile.works_afternoon },
            { icon: 'moon-outline',         label: 'Evening (6pm–10pm)',   value: profile.works_evening },
            { icon: 'cloudy-night-outline', label: 'Night (10pm–6am)',     value: profile.works_night },
          ].map((hour, i) => <PreferenceRow key={i} {...hour} />)}
        </View>
      </View>

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