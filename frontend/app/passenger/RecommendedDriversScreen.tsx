import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, Alert,
  SafeAreaView, Platform
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { recommendDrivers } from '../../services/recommendationService';
import DriverRecoCard from '../../components/DriverRecommendationCard';
import { Ionicons } from '@expo/vector-icons';

export default function RecommendedDriversScreen() {
  const params = useLocalSearchParams();

  const [drivers, setDrivers]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedIds, setSelectedIds]   = useState<Set<number>>(new Set());

  useEffect(() => { loadRecommendations(); }, []);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const raw = await AsyncStorage.getItem('tripRequest');
      if (!raw) { Alert.alert('Error', 'Ride information is missing'); router.back(); return; }

      const tripRequest = JSON.parse(raw);
      const response = await recommendDrivers(
        tripRequest.passengerId,
        tripRequest.preferences,
        tripRequest.trajet || {},
        5
      );

      if (response.recommendedDrivers?.length > 0) {
        setDrivers(response.recommendedDrivers);
      } else {
        Alert.alert('Info', 'No drivers available for your preferences');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || error.message || 'Service unavailable');
    } finally {
      setLoading(false);
    }
  };

  // ── Toggle sélection ──────────────────────────────────────────────────────
  const toggleSelect = (driver: any) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(driver.id)) next.delete(driver.id);
      else next.add(driver.id);
      return next;
    });
  };

  // ── Select all / Deselect all ─────────────────────────────────────────────
  const toggleSelectAll = () => {
    if (selectedIds.size === drivers.length) {
      setSelectedIds(new Set()); // tout désélectionner
    } else {
      setSelectedIds(new Set(drivers.map(d => d.id))); // tout sélectionner
    }
  };

  // ── Long press → voir profil ──────────────────────────────────────────────
  const handleViewProfile = (driver: any) => {
    router.push({
      pathname: '/passenger/DriverProfileScreen',
      params: { driverId: driver.id }
    } as any);
  };

  // ── Confirmation ──────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (selectedIds.size === 0) { Alert.alert('Warning', 'Sélectionnez au moins un conducteur'); return; }

    const selected = drivers.filter(d => selectedIds.has(d.id));
    const names    = selected.map(d => `${d.prenom} ${d.nom}`).join(', ');

    Alert.alert(
      'Confirmer la réservation',
      `Notifier ${selected.length} conducteur${selected.length > 1 ? 's' : ''} :\n${names}`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: async () => {
          await AsyncStorage.removeItem('tripRequest');
          router.replace('/(passengerTabs)/PassengerHomeScreen');
        }},
      ]
    );
  };

  const allSelected = selectedIds.size === drivers.length && drivers.length > 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#111" />
        <Text style={styles.loadingText}>Recherche en cours...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>Conducteurs recommandés</Text>
          {(params.depart || params.destination) && (
            <Text style={styles.headerSub} numberOfLines={1}>
              {params.depart} → {params.destination}
            </Text>
          )}
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{drivers.length}</Text>
        </View>
      </View>

      {/* ── Barre actions ── */}
      {drivers.length > 0 && (
        <View style={styles.actionsBar}>
          <Text style={styles.actionsHint}>
            <Ionicons name="hand-left-outline" size={11} /> Tap = sélectionner  ·  
            <Ionicons name="time-outline"      size={11} /> Maintenir = profil
          </Text>
          <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAll}>
            <Ionicons
              name={allSelected ? "checkbox" : "checkbox-outline"}
              size={16}
              color="#111"
            />
            <Text style={styles.selectAllText}>
              {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Liste ── */}
      <FlatList
        data={drivers}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <DriverRecoCard
            driver={item}
            isSelected={selectedIds.has(item.id)}
            onPress={toggleSelect}
            onLongPress={handleViewProfile}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={52} color="#D1D5DB" />
            <Text style={styles.emptyText}>Aucun conducteur disponible</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadRecommendations}>
              <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* ── Bottom bar ── */}
      <View style={styles.bottomBar}>
        {selectedIds.size > 0 && (
          <Text style={styles.selectedCount}>
            {selectedIds.size} conducteur{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.confirmBtn, selectedIds.size === 0 && styles.confirmBtnOff]}
          onPress={handleConfirm}
          disabled={selectedIds.size === 0}
          activeOpacity={0.85}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={19}
            color={selectedIds.size > 0 ? '#fff' : '#9CA3AF'}
          />
          <Text style={[styles.confirmText, selectedIds.size === 0 && styles.confirmTextOff]}>
            {selectedIds.size > 0
              ? `Notifier ${selectedIds.size} conducteur${selectedIds.size > 1 ? 's' : ''}`
              : 'Sélectionnez un conducteur'}
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 15, color: '#6B7280' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  headerSub:   { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  countPill:   {
    backgroundColor: '#111', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  countPillText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Actions bar
  actionsBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  actionsHint: { fontSize: 10, color: '#9CA3AF', flex: 1 },
  selectAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  selectAllText: { fontSize: 13, fontWeight: '600', color: '#111' },

  list: { padding: 12, paddingBottom: 120 },

  // Empty
  empty:     { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF', fontWeight: '600' },
  retryBtn:  { backgroundColor: '#111', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Bottom bar
  bottomBar: {
    backgroundColor: '#fff', paddingHorizontal: 16,
    paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1, borderTopColor: '#F0F0F0', gap: 6,
  },
  selectedCount: {
    fontSize: 12, color: '#6B7280', fontWeight: '600', textAlign: 'center',
  },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#111', borderRadius: 50, paddingVertical: 15,
  },
  confirmBtnOff: { backgroundColor: '#F5F5F5' },
  confirmText:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  confirmTextOff:{ color: '#9CA3AF' },
});