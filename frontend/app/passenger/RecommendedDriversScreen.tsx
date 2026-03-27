import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, Modal, Dimensions, Animated
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { recommendDrivers } from '../../services/recommendationService';
import DriverRecoCard from '../../components/DriverRecommendationCard';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSocket } from '../../services/socket';

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

// ── MODAL FALLBACK ✅ NOUVEAU ──────────────────────────────────────────────────
// S'affiche quand tous les drivers contactés ont refusé/timeout
// Propose soit les 5 restants, soit une nouvelle recherche
function FallbackModal({ visible, type, backupDrivers, rideId, onClose, onSent }: any) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sending, setSending]         = useState(false);
  const [loadingNew, setLoadingNew]   = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      setSelectedIds(new Set());
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true,
        tension: 65, friction: 11,
      }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [visible]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Envoyer aux drivers de backup sélectionnés ────────────────────────────
  const handleSendBackup = async () => {
    if (selectedIds.size === 0) return;
    try {
      setSending(true);
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/ridesDem/send-fallback`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ rideId, driverIds: Array.from(selectedIds) }),
      });
      const data = await response.json();
      if (response.ok) {
        onSent(data.driversNotified);
      } else {
        console.error('Fallback error:', data.message);
      }
    } catch (e: any) {
      console.error('Fallback error:', e.message);
    } finally {
      setSending(false);
    }
  };

  // ── Lancer une nouvelle recherche de drivers ──────────────────────────────
  const handleNewSearch = async () => {
    try {
      setLoadingNew(true);
      const raw = await AsyncStorage.getItem('tripRequest');
      if (!raw) return;
      const trip = JSON.parse(raw);

      // Appeler FastAPI avec top_n=10 et exclure les drivers déjà contactés
      const sentIds = backupDrivers.map((d: any) => d.id); // déjà envoyés
      const response = await recommendDrivers(
        trip.passengerId,
        trip.preferences || {},
        trip.trajet || {},
        10
      );

      // Filtrer les drivers déjà contactés
      const fresh = (response?.recommendedDrivers || []).filter(
        (d: any) => !sentIds.includes(d.id)
      ).slice(0, 5);

      if (fresh.length === 0) {
        onClose('NO_DRIVERS');
        return;
      }

      // Envoyer directement les 5 nouveaux
      const token = await AsyncStorage.getItem('token');
      const res2 = await fetch(`${API_URL}/ridesDem/send-fallback`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ rideId, driverIds: fresh.map((d: any) => d.id) }),
      });
      const data = await res2.json();
      if (res2.ok) {
        onSent(data.driversNotified);
      }
    } catch (e: any) {
      console.error('New search error:', e.message);
    } finally {
      setLoadingNew(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={() => onClose('DISMISSED')}>
      <View style={fbStyles.overlay}>
        <Animated.View style={[fbStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>

          {/* Header */}
          <View style={fbStyles.header}>
            <View style={fbStyles.warningCircle}>
              <Ionicons name="time-outline" size={28} color="#F59E0B" />
            </View>
            <Text style={fbStyles.title}>Aucune réponse reçue</Text>
            <Text style={fbStyles.subtitle}>
              {type === 'BACKUP_AVAILABLE'
                ? 'Les conducteurs contactés n\'ont pas répondu. Voici d\'autres conducteurs recommandés pour vous.'
                : 'Tous les conducteurs recommandés ont été contactés. Voulez-vous lancer une nouvelle recherche ?'
              }
            </Text>
          </View>

          {/* CAS 1 : Backup disponible → afficher les 5 restants */}
          {type === 'BACKUP_AVAILABLE' && backupDrivers.length > 0 && (
            <>
              <Text style={fbStyles.sectionLabel}>Conducteurs disponibles</Text>
              <View style={fbStyles.driversList}>
                {backupDrivers.slice(0, 5).map((d: any) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[fbStyles.driverRow, selectedIds.has(d.id) && fbStyles.driverRowSelected]}
                    onPress={() => toggleSelect(d.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[fbStyles.avatar, { backgroundColor: d.sexe === 'F' ? '#FCE4EC' : '#E8F0FE' }]}>
                      <Text style={[fbStyles.avatarText, { color: d.sexe === 'F' ? '#C2185B' : '#1A73E8' }]}>
                        {d.prenom?.[0]}{d.nom?.[0]}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={fbStyles.driverName}>{d.prenom} {d.nom}</Text>
                      <Text style={fbStyles.driverSub}>
                        {d.distance_km ? `${d.distance_km} km · ` : ''}
                        ⭐ {d.avgRating?.toFixed(1) ?? '—'}
                        {d.work_match ? ' · 🕐 Disponible' : ''}
                      </Text>
                    </View>
                    <View style={[fbStyles.checkbox, selectedIds.has(d.id) && fbStyles.checkboxSelected]}>
                      {selectedIds.has(d.id) && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[fbStyles.primaryBtn, (selectedIds.size === 0 || sending) && fbStyles.primaryBtnOff]}
                onPress={handleSendBackup}
                disabled={selectedIds.size === 0 || sending}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="paper-plane-outline" size={16} color={selectedIds.size > 0 ? '#fff' : '#9CA3AF'} />
                }
                <Text style={[fbStyles.primaryBtnText, (selectedIds.size === 0 || sending) && fbStyles.primaryBtnTextOff]}>
                  {sending
                    ? 'Envoi...'
                    : selectedIds.size > 0
                      ? `Contacter ${selectedIds.size} conducteur${selectedIds.size > 1 ? 's' : ''}`
                      : 'Sélectionnez au moins un conducteur'
                  }
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* CAS 2 : Nouvelle recherche */}
          {type === 'NEW_SEARCH' && (
            <TouchableOpacity
              style={[fbStyles.primaryBtn, loadingNew && fbStyles.primaryBtnOff]}
              onPress={handleNewSearch}
              disabled={loadingNew}
            >
              {loadingNew
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="search-outline" size={16} color="#fff" />
              }
              <Text style={fbStyles.primaryBtnText}>
                {loadingNew ? 'Recherche en cours...' : 'Chercher de nouveaux conducteurs'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Annuler le trajet */}
          <TouchableOpacity style={fbStyles.cancelBtn} onPress={() => onClose('CANCEL_RIDE')}>
            <Text style={fbStyles.cancelBtnText}>Annuler le trajet</Text>
          </TouchableOpacity>

        </Animated.View>
      </View>
    </Modal>
  );
}

// ── SCREEN PRINCIPAL ──────────────────────────────────────────────────────────
export default function RecommendedDriversScreen() {
  const params     = useLocalSearchParams();
  const insets     = useSafeAreaInsets();
  

  const [drivers, setDrivers]                 = useState<any[]>([]);
  const [allRecommended, setAllRecommended]   = useState<any[]>([]); // ✅ Les 10
  const [loading, setLoading]                 = useState(true);
  const [sending, setSending]                 = useState(false);
  const [selectedIds, setSelectedIds]         = useState<Set<number>>(new Set());
  const [showConfirm, setShowConfirm]         = useState(false);
  const [showSent, setShowSent]               = useState(false);
  const [sentCount, setSentCount]             = useState(0);
  const [tripRequest, setTripRequest]         = useState<any>(null);

  // ✅ États pour le fallback modal
  const [fallbackVisible, setFallbackVisible] = useState(false);
  const [fallbackType, setFallbackType]       = useState<'BACKUP_AVAILABLE' | 'NEW_SEARCH'>('BACKUP_AVAILABLE');
  const [fallbackDrivers, setFallbackDrivers] = useState<any[]>([]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('fallbackRequired', (data) => {
      setFallbackType(data.type);
      setFallbackDrivers(data.backupDrivers || []);
      setFallbackVisible(true);
    });
    return () => socket.off('fallbackRequired');
  }, []);
  useEffect(() => { loadRecommendations(); }, []);

  const loadRecommendations = async () => {
    try {
  
      setLoading(true);

      const raw = await AsyncStorage.getItem('tripRequest');
      if (!raw) { router.back(); return; }

      const trip = JSON.parse(raw);
      setTripRequest(trip);

      const trajet = trip.trajet || {};

      // ── Appel API recommendation — top_n=10 ✅ ─────────────────────────────
      const response = await recommendDrivers(trip.passengerId, trip.preferences || {}, trajet, 10);

      const all = response?.recommendedDrivers || [];
      setAllRecommended(all);       // Stocker les 10
      setDrivers(all.slice(0, 5)); // Afficher les 5 premiers

    } catch (error: any) {
      console.error('❌ [RecommendedDrivers] Erreur:', error.message);
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

  const handleConfirmSend = async () => {
    if (!tripRequest?.rideId || selectedIds.size === 0) return;

    try {
      setSending(true);
      setShowConfirm(false);

      const token = await AsyncStorage.getItem('token');

      // Trouver les scores du premier driver sélectionné
      const firstSelected = allRecommended.find(d => selectedIds.has(d.id));

      const response = await fetch(`${API_URL}/ridesDem/send-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          rideId:                tripRequest.rideId,
          driverIds:             Array.from(selectedIds),
          preferences:           tripRequest.preferences || {},
          chosenDriverScores:    firstSelected?._scores || null,
          // ✅ NOUVEAU : envoyer les 10 pour stockage en DB
          allRecommendedDrivers: allRecommended,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Erreur sendRideRequests:', data.message);
      } else {
        console.log(`✅ ${data.driversNotified} drivers notifiés`);
        setSentCount(data.driversNotified);
      }

      await AsyncStorage.removeItem('tripRequest');
      setShowSent(true);

    } catch (error: any) {
      console.error('❌ Erreur envoi demande:', error.message);
      await AsyncStorage.removeItem('tripRequest');
      setShowSent(true);
    } finally {
      setSending(false);
    }
  };

  // ✅ Gérer la fermeture du fallback modal
  const handleFallbackClose = async (reason: string) => {
    setFallbackVisible(false);
    if (reason === 'CANCEL_RIDE') {
      // Annuler le trajet via l'API
      try {
        const token = await AsyncStorage.getItem('token');
        await fetch(`${API_URL}/rides/${tripRequest?.rideId}/cancel`, {
          method:  'PATCH',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch (e) {
        console.error('Cancel ride error:', e);
      }
      router.replace('/(passengerTabs)/PassengerHomeScreen');
    }
    // Si 'DISMISSED' → ne rien faire, le modal se ferme juste
  };

  // ✅ Gérer quand le fallback a envoyé les demandes
  const handleFallbackSent = (count: number) => {
    setFallbackVisible(false);
    setSentCount(count);
    setShowSent(true);
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

      {/* Liste — 5 premiers seulement */}
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
        count={sentCount}
        onClose={handleCloseSent}
      />

      {/* ✅ NOUVEAU : Modal fallback */}
      <FallbackModal
        visible={fallbackVisible}
        type={fallbackType}
        backupDrivers={fallbackDrivers}
        rideId={tripRequest?.rideId}
        onClose={handleFallbackClose}
        onSent={handleFallbackSent}
      />
    </View>
  );
}

// ── STYLES screen ─────────────────────────────────────────────────────────────
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

// ── STYLES modals existants ───────────────────────────────────────────────────
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

// ── STYLES fallback modal ✅ NOUVEAU ──────────────────────────────────────────
const fbStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36, gap: 12,
  },
  header:       { alignItems: 'center', gap: 10, marginBottom: 4 },
  warningCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center',
  },
  title:     { fontSize: 20, fontWeight: '800', color: '#111', textAlign: 'center' },
  subtitle:  { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 4 },
  driversList: { gap: 8 },
  driverRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 12,
    borderWidth: 2, borderColor: 'transparent',
  },
  driverRowSelected: { borderColor: '#111', backgroundColor: '#F0F0F0' },
  avatar:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '800' },
  driverName: { fontSize: 14, fontWeight: '700', color: '#111' },
  driverSub:  { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: '#111', borderColor: '#111' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#111', borderRadius: 14, paddingVertical: 15,
    marginTop: 8,
  },
  primaryBtnOff:     { backgroundColor: '#F5F5F5' },
  primaryBtnText:    { fontSize: 15, fontWeight: '700', color: '#fff' },
  primaryBtnTextOff: { color: '#9CA3AF' },
  cancelBtn: {
    alignItems: 'center', paddingVertical: 12, borderRadius: 14,
    backgroundColor: '#FEF2F2',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
});