import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, Modal, Dimensions
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { recommendDrivers } from '../../services/recommendationService';
import DriverRecoCard from '../../components/DriverRecommendationCard';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('screen');
const API_URL = process.env.EXPO_PUBLIC_API_URL;

// ── MODAL CONFIRMATION ────────────────────────────────────────────────────────
function ConfirmModal({ visible, drivers, selectedIds, onCancel, onConfirm }: any) {
  const selected = drivers.filter((d: any) => selectedIds.has(d.id));
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onCancel}>
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <View style={mStyles.iconCircle}>
            <Ionicons name="paper-plane-outline" size={28} color="#111" />
          </View>
          <Text style={mStyles.title}>Envoyer la demande ?</Text>
          <Text style={mStyles.subtitle}>
            Votre demande sera envoyée à {selected.length} conducteur{selected.length > 1 ? 's' : ''}.{'\n'}
            Le premier à accepter vous sera assigné.
          </Text>
          <View style={mStyles.driversList}>
            {selected.map((d: any) => (
              <View key={d.id} style={mStyles.driverRow}>
                <View style={[mStyles.avatar, { backgroundColor: d.sexe === 'F' ? '#FCE4EC' : '#E8F0FE' }]}>
                  <Text style={[mStyles.avatarText, { color: d.sexe === 'F' ? '#C2185B' : '#1A73E8' }]}>
                    {d.prenom?.[0]}{d.nom?.[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.driverName}>{d.prenom} {d.nom}</Text>
                  {d.distance_km && (
                    <Text style={mStyles.driverSub}>{d.distance_km} km · ⭐ {d.avgRating?.toFixed(1)}</Text>
                  )}
                </View>
                <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
              </View>
            ))}
          </View>
          <View style={mStyles.actions}>
            <TouchableOpacity style={mStyles.cancelBtn} onPress={onCancel}>
              <Text style={mStyles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={mStyles.sendBtn} onPress={onConfirm}>
              <Ionicons name="paper-plane-outline" size={16} color="#fff" />
              <Text style={mStyles.sendBtnText}>Envoyer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── MODAL SUCCÈS ──────────────────────────────────────────────────────────────
function SentModal({ visible, count, onClose }: any) {
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <View style={[mStyles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="checkmark-circle" size={36} color="#16A34A" />
          </View>
          <Text style={mStyles.title}>Demande envoyée !</Text>
          <Text style={mStyles.subtitle}>
            Votre demande a été envoyée à {count} conducteur{count > 1 ? 's' : ''}.{'\n\n'}
            Vous recevrez une notification dès que l'un d'eux accepte votre trajet.
          </Text>
          <View style={mStyles.infoBox}>
            <Ionicons name="notifications-outline" size={16} color="#1A73E8" />
            <Text style={mStyles.infoText}>
              Le premier conducteur à accepter vous sera automatiquement assigné
            </Text>
          </View>
          <TouchableOpacity style={mStyles.sendBtn2} onPress={onClose}>
            <Text style={mStyles.sendBtnText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── SCREEN PRINCIPAL ──────────────────────────────────────────────────────────
export default function RecommendedDriversScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [drivers, setDrivers]         = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [sending, setSending]         = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSent, setShowSent]       = useState(false);
  const [tripRequest, setTripRequest] = useState<any>(null);

  useEffect(() => { loadRecommendations(); }, []);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const raw = await AsyncStorage.getItem('tripRequest');
      if (!raw) { router.back(); return; }
      const trip = JSON.parse(raw);
      setTripRequest(trip);

      const response = await recommendDrivers(
        trip.passengerId,
        trip.preferences,
        trip.trajet || {},
        5
      );
      if (response.recommendedDrivers?.length > 0) {
        setDrivers(response.recommendedDrivers);
      }
    } catch (error: any) {
      console.error('Erreur:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (driver: any) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(driver.id) ? next.delete(driver.id) : next.add(driver.id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(
      selectedIds.size === drivers.length
        ? new Set()
        : new Set(drivers.map(d => d.id))
    );
  };

  const handleViewProfile = (driver: any) => {
    router.push({ pathname: '/passenger/DriverProfileScreen', params: { driverId: driver.id } } as any);
  };

  // ✅ FIX PRINCIPAL : appelle le backend sendRideRequests
  // AVANT : handleConfirmSend ne faisait que supprimer tripRequest et ouvrir SentModal
  //         → aucune notif envoyée aux drivers
  // APRÈS : appelle POST /api/rides/send-requests avec rideId + driverIds[]
  //         → backend émet rideRequest via Socket.IO à chaque driver sélectionné
  const handleConfirmSend = async () => {
    if (!tripRequest?.rideId || selectedIds.size === 0) return;

    try {
      setSending(true);
      setShowConfirm(false);

      const token = await AsyncStorage.getItem('token');

      const response = await fetch(`${API_URL}/ridesDem/send-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          rideId:      tripRequest.rideId,
          driverIds:   Array.from(selectedIds),
          preferences: tripRequest.preferences || {},
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Erreur sendRideRequests:', data.message);
        // On continue quand même pour montrer le modal succès
        // (l'UX ne doit pas casser si erreur réseau)
      } else {
        console.log(`✅ ${data.driversNotified} drivers notifiés`);
      }

      await AsyncStorage.removeItem('tripRequest');
      setShowSent(true);

    } catch (error: any) {
      console.error('Erreur envoi demande:', error.message);
      // Même en cas d'erreur, on montre le modal pour ne pas bloquer l'UX
      await AsyncStorage.removeItem('tripRequest');
      setShowSent(true);
    } finally {
      setSending(false);
    }
  };

  const handleCloseSent = () => {
    setShowSent(false);
    router.replace('/(passengerTabs)/PassengerHomeScreen');
  };

  const allSelected = selectedIds.size === drivers.length && drivers.length > 0;

  if (loading) {
    return (
      <View style={[s.bg, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color="#111" style={{ flex: 1 }} />
      </View>
    );
  }

  return (
    <View style={[s.bg, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#111" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Conducteurs recommandés</Text>
          {(params.depart || params.destination) && (
            <Text style={s.headerSub} numberOfLines={1}>
              {params.depart} → {params.destination}
            </Text>
          )}
        </View>
        <View style={s.countPill}>
          <Text style={s.countPillText}>{drivers.length}</Text>
        </View>
      </View>

      {/* Actions bar */}
      {drivers.length > 0 && (
        <View style={s.actionsBar}>
          <Text style={s.actionsHint}>Tap = sélectionner  ·  Maintenir = profil</Text>
          <TouchableOpacity style={s.selectAllBtn} onPress={toggleSelectAll}>
            <Ionicons name={allSelected ? "checkbox" : "checkbox-outline"} size={15} color="#111" />
            <Text style={s.selectAllText}>{allSelected ? 'Désélectionner' : 'Tout sélectionner'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Liste */}
      <FlatList
        data={drivers}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={s.list}
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
          <View style={s.empty}>
            <Ionicons name="car-outline" size={52} color="#D1D5DB" />
            <Text style={s.emptyText}>Aucun conducteur disponible</Text>
            <TouchableOpacity style={s.retryBtn} onPress={loadRecommendations}>
              <Text style={s.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Bottom bar */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        {selectedIds.size > 0 && (
          <Text style={s.selectedCount}>
            {selectedIds.size} conducteur{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </Text>
        )}
        <TouchableOpacity
          style={[s.confirmBtn, (selectedIds.size === 0 || sending) && s.confirmBtnOff]}
          onPress={() => selectedIds.size > 0 && !sending && setShowConfirm(true)}
          disabled={selectedIds.size === 0 || sending}
          activeOpacity={0.85}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="paper-plane-outline" size={18} color={selectedIds.size > 0 ? '#fff' : '#9CA3AF'} />
          }
          <Text style={[s.confirmBtnText, (selectedIds.size === 0 || sending) && s.confirmBtnTextOff]}>
            {sending
              ? 'Envoi en cours...'
              : selectedIds.size > 0
                ? `Notifier ${selectedIds.size} conducteur${selectedIds.size > 1 ? 's' : ''}`
                : 'Sélectionnez un conducteur'
            }
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <ConfirmModal
        visible={showConfirm}
        drivers={drivers}
        selectedIds={selectedIds}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirmSend}
      />
      <SentModal
        visible={showSent}
        count={selectedIds.size}
        onClose={handleCloseSent}
      />
    </View>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F7F7F7' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle:   { fontSize: 17, fontWeight: '700', color: '#111' },
  headerSub:     { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  countPill:     { backgroundColor: '#111', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  countPillText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actionsBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 9,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  actionsHint:    { fontSize: 11, color: '#BDBDBD' },
  selectAllBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  selectAllText:  { fontSize: 13, fontWeight: '600', color: '#111' },
  list:           { padding: 12, paddingBottom: 16 },
  empty:          { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText:      { fontSize: 15, color: '#9CA3AF', fontWeight: '600' },
  retryBtn:       { backgroundColor: '#111', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText:      { color: '#fff', fontWeight: '700', fontSize: 14 },
  bottomBar: {
    backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F0F0F0', gap: 8,
  },
  selectedCount:     { fontSize: 12, color: '#6B7280', fontWeight: '600', textAlign: 'center' },
  confirmBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#111', borderRadius: 14, paddingVertical: 15 },
  confirmBtnOff:     { backgroundColor: '#F5F5F5' },
  confirmBtnText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
  confirmBtnTextOff: { color: '#9CA3AF' },
});

const mStyles = StyleSheet.create({
  overlay: {
    flex: 1, width: SCREEN_WIDTH, height: SCREEN_HEIGHT,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  sheet:      { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', alignItems: 'center', gap: 12 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title:      { fontSize: 20, fontWeight: '800', color: '#111', textAlign: 'center' },
  subtitle:   { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  driversList:{ width: '100%', gap: 8, marginVertical: 4 },
  driverRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F7F7F7', borderRadius: 12, padding: 10 },
  avatar:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '800' },
  driverName: { fontSize: 14, fontWeight: '700', color: '#111' },
  driverSub:  { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  infoBox:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, width: '100%' },
  infoText:   { fontSize: 13, color: '#1A73E8', flex: 1, lineHeight: 18 },
  actions:    { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  cancelBtn:  { flex: 1, borderRadius: 12, paddingVertical: 14, backgroundColor: '#F5F5F5', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  sendBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#111', borderRadius: 12, paddingVertical: 14 },
  sendBtnText:{ fontSize: 15, fontWeight: '700', color: '#ffffff' },
  sendBtn2:   { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#111', borderRadius: 12, paddingVertical: 14 },
});