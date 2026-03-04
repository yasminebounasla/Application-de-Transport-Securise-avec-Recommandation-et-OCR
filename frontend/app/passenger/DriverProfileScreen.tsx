import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../services/api'; 

export default function DriverProfileScreen() {
  const { driverId } = useLocalSearchParams();
  const router = useRouter();
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDriverProfile();
  }, []);

  const fetchDriverProfile = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    console.log('🔍 Fetching:', `${API_URL}/drivers/${driverId}`); 
    console.log('🔍 driverId:', driverId); 
    const response = await axios.get(`${API_URL}/drivers/${driverId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setDriver(response.data.data);
  } catch (error) {
    console.error('Error fetching driver profile:', error);
  } finally {
    setLoading(false);
  }
};

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  if (!driver) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Driver not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const vehicule = driver.vehicules?.[0];

    const renderStars = (rating: number) => {
  const stars = [];
  for (let i = 0; i < 5; i++) {
    stars.push(
      <Ionicons
        key={i}
        name={i < Math.round(rating) ? 'star' : 'star-outline'}
        size={18}
        color={i < Math.round(rating) ? '#FFB800' : '#DDD'}
      />
    );
  }
  return stars;
};

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Avatar & Name */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color="#FFF" />
          </View>
          <Text style={styles.name}>{driver.prenom} {driver.nom}</Text>
          <View style={styles.verifiedBadge}>
            <Ionicons
              name={driver.isVerified ? 'checkmark-circle' : 'time-outline'}
              size={16}
              color={driver.isVerified ? '#22C55E' : '#F59E0B'}
            />
            <Text style={[styles.verifiedText, { color: driver.isVerified ? '#22C55E' : '#F59E0B' }]}>
              {driver.isVerified ? 'Verified Driver' : 'Pending Verification'}
            </Text>
          </View>
        </View>

        {/* Rating */}
        <View style={styles.card}>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingNumber}>{driver.stats?.avgRating ?? '0.0'}</Text>
            <View style={styles.starsRow}>
              {renderStars(driver.stats?.avgRating || 0)}
            </View>
            <Text style={styles.ratingCount}>{driver.stats?.ratingsCount} review{driver.stats?.ratingsCount !== 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.statRow}>
          </View>
        </View>

        {/* Driver Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Driver Info</Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color="#666" style={styles.infoIcon} />
            <View>
              <Text style={styles.infoLabel}>Age</Text>
              <Text style={styles.infoValue}>{driver.age} years</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color="#666" style={styles.infoIcon} />
            <View>
              <Text style={styles.infoLabel}>Gender</Text>
              <Text style={styles.infoValue}>{driver.sexe === 'M' ? 'Male' : 'Female'}</Text>
            </View>
          </View>
        </View>

        {/* Vehicle */}
        {vehicule && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Vehicle</Text>
            <View style={styles.infoRow}>
              <Ionicons name="car-outline" size={20} color="#666" style={styles.infoIcon} />
              <View>
                <Text style={styles.infoLabel}>Model</Text>
                <Text style={styles.infoValue}>
                  {vehicule.marque} {vehicule.modele} {vehicule.annee ? `(${vehicule.annee})` : ''}
                </Text>
              </View>
            </View>
            {vehicule.couleur && (
              <View style={styles.infoRow}>
                <Ionicons name="color-palette-outline" size={20} color="#666" style={styles.infoIcon} />
                <View>
                  <Text style={styles.infoLabel}>Color</Text>
                  <Text style={styles.infoValue}>{vehicule.couleur}</Text>
                </View>
              </View>
            )}
            {vehicule.nbPlaces && (
              <View style={styles.infoRow}>
                <Ionicons name="people-outline" size={20} color="#666" style={styles.infoIcon} />
                <View>
                  <Text style={styles.infoLabel}>Seats</Text>
                  <Text style={styles.infoValue}>{vehicule.nbPlaces} seats</Text>
                </View>
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  errorText: { fontSize: 16, color: '#666', marginBottom: 16 },
  backBtn: { backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: '#FFF', fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  backButton: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  content: { padding: 16, paddingBottom: 40 },

  profileSection: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  name: { fontSize: 22, fontWeight: '700', color: '#000', marginBottom: 8 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verifiedText: { fontSize: 13, fontWeight: '600' },

  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, borderWidth: 1, borderColor: '#F0F0F0',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 16 },

  ratingContainer: { alignItems: 'center', marginBottom: 16 },
  ratingNumber: { fontSize: 48, fontWeight: '800', color: '#000' },
  starsRow: { flexDirection: 'row', gap: 4, marginVertical: 6 },
  ratingCount: { fontSize: 14, color: '#999' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statText: { fontSize: 14, color: '#666' },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  infoIcon: { marginRight: 12, marginTop: 2 },
  infoLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
  infoValue: { fontSize: 15, color: '#000', fontWeight: '500' },
});