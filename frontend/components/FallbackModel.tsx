import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  ActivityIndicator, Animated, ScrollView, StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { recommendDrivers } from '../services/recommendationService';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

function Stars({ rating }: { rating: number }) {
  const safe  = Math.min(5, Math.max(0, rating ?? 0));
  const full  = Math.floor(safe);
  const half  = safe - full >= 0.25 && safe - full < 0.75;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
      {Array.from({ length: full  }).map((_, i) => <Ionicons key={`f${i}`} name="star"         size={12} color="#F59E0B" />)}
      {half &&                                       <Ionicons              name="star-half"    size={12} color="#F59E0B" />}
      {Array.from({ length: empty }).map((_, i) => <Ionicons key={`e${i}`} name="star-outline" size={12} color="#E5E7EB" />)}
      <Text style={fb.ratingNum}>{safe.toFixed(1)}</Text>
    </View>
  );
}

export function FallbackModal({ visible, type, backupDrivers, rideId, onClose, onSent }: any) {
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
      if (response.ok) onSent(data.driversNotified);
      else console.error('Fallback error:', data.message);
    } catch (e: any) {
      console.error('Fallback error:', e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={() => onClose('DISMISSED')}>
      <View style={fb.overlay}>
        <Animated.View style={[fb.sheet, { transform: [{ translateY: slideAnim }] }]}>

          {/* Handle */}
          <View style={fb.handle} />

          {/* Header */}
          <View style={fb.header}>
            <View style={fb.warningCircle}>
              <Ionicons name="time-outline" size={28} color="#F59E0B" />
            </View>
            <Text style={fb.title}>Aucune réponse reçue</Text>
            <Text style={fb.subtitle}>
              {type === 'BACKUP_AVAILABLE'
                ? "Les conducteurs contactés n'ont pas répondu. Voici d'autres conducteurs recommandés."
                : "Tous les conducteurs ont été contactés. Voulez-vous lancer une nouvelle recherche ?"
              }
            </Text>
          </View>

          {/* CAS 1 : backup drivers */}
          {type === 'BACKUP_AVAILABLE' && backupDrivers.length > 0 && (
            <>
              <Text style={fb.sectionLabel}>Conducteurs disponibles</Text>

              <ScrollView
                style={{ maxHeight: 280 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {backupDrivers.slice(0, 5).map((d: any) => {
                  const selected = selectedIds.has(d.id);
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={[fb.driverRow, selected && fb.driverRowSelected]}
                      onPress={() => toggleSelect(d.id)}
                      onLongPress={() => router.push({
                        pathname: '/passenger/DriverProfileScreen',
                        params: { driverId: d.id }
                      } as any)}
                      delayLongPress={400}
                      activeOpacity={0.8}
                    >
                      {/* Avatar */}
                      <View style={[fb.avatar, { backgroundColor: d.sexe === 'F' ? '#FCE4EC' : '#E8F0FE' }]}>
                        <Text style={[fb.avatarText, { color: d.sexe === 'F' ? '#C2185B' : '#1A73E8' }]}>
                          {d.prenom?.[0]}{d.nom?.[0]}
                        </Text>
                      </View>

                      {/* Infos */}
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={fb.driverName}>{d.prenom} {d.nom}</Text>
                        <Stars rating={d.avgRating ?? 0} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {d.distance_km && (
                            <View style={fb.tag}>
                              <Ionicons name="location-outline" size={10} color="#9CA3AF" />
                              <Text style={fb.tagText}>{d.distance_km} km</Text>
                            </View>
                          )}
                          {d.work_match && (
                            <View style={fb.dispoBadge}>
                              <View style={fb.dispoDot} />
                              <Text style={fb.dispoText}>Horaires ✓</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Checkbox */}
                      <View style={[fb.checkbox, selected && fb.checkboxSelected]}>
                        {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[fb.primaryBtn, (selectedIds.size === 0 || sending) && fb.primaryBtnOff]}
                onPress={handleSendBackup}
                disabled={selectedIds.size === 0 || sending}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="paper-plane-outline" size={16} color={selectedIds.size > 0 ? '#fff' : '#9CA3AF'} />
                }
                <Text style={[fb.primaryBtnText, (selectedIds.size === 0 || sending) && fb.primaryBtnTextOff]}>
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

          {/* Annuler */}
          <TouchableOpacity style={fb.cancelBtn} onPress={() => onClose('CANCEL_RIDE')}>
            <Text style={fb.cancelBtnText}>Annuler le trajet</Text>
          </TouchableOpacity>

        </Animated.View>
      </View>
    </Modal>
  );
}

const fb = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36, gap: 12,
    maxHeight: '80%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 8,
  },
  header:        { alignItems: 'center', gap: 10, marginBottom: 4 },
  warningCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center' },
  title:         { fontSize: 19, fontWeight: '800', color: '#111', textAlign: 'center' },
  subtitle:      { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  sectionLabel:  { fontSize: 13, fontWeight: '700', color: '#374151' },

  driverRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 14, padding: 12,
    borderWidth: 2, borderColor: 'transparent',
  },
  driverRowSelected: {
    borderColor: '#111',
    backgroundColor: '#F0F0F0',
  },

  avatar:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '800' },
  driverName: { fontSize: 14, fontWeight: '700', color: '#111' },
  ratingNum:  { fontSize: 11, fontWeight: '600', color: '#9CA3AF', marginLeft: 3 },

  tag:       { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F5F5F5', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tagText:   { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },

  dispoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0FDF4', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  dispoDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' },
  dispoText:  { fontSize: 10, fontWeight: '700', color: '#16A34A' },

  checkbox:         { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: '#111', borderColor: '#111' },

  primaryBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#111', borderRadius: 14, paddingVertical: 15, marginTop: 4 },
  primaryBtnOff:     { backgroundColor: '#F5F5F5' },
  primaryBtnText:    { fontSize: 15, fontWeight: '700', color: '#fff' },
  primaryBtnTextOff: { color: '#9CA3AF' },

  cancelBtn:     { alignItems: 'center', paddingVertical: 12, borderRadius: 14, backgroundColor: '#FEF2F2' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
});