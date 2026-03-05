import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../services/api';
import { getPublicDriverStats, getPublicDriverFeedback } from '../../services/feedbackService';

// ─────────────────────────────────────────────
// STAR ROW
// ─────────────────────────────────────────────
function StarRow({ rating, size = 14 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={i <= Math.round(rating) ? '#CA8A04' : '#DDD'}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
// PREFERENCE CHIP (only shown if value = true)
// ─────────────────────────────────────────────
const PREF_CONFIG = [
  { key: 'talkative',       icon: 'chatbubbles-outline',   label: 'Talkative' },
  { key: 'radio_on',        icon: 'musical-notes-outline', label: 'Radio On' },
  { key: 'smoking_allowed', icon: 'flame-outline',         label: 'Smoking OK' },
  { key: 'pets_allowed',    icon: 'paw-outline',           label: 'Pets OK' },
  { key: 'car_big',         icon: 'car-sport-outline',     label: 'Large Car' },
];

const HOURS_CONFIG = [
  { key: 'works_morning',   icon: 'sunny-outline',        label: 'Morning (6am–12pm)' },
  { key: 'works_afternoon', icon: 'partly-sunny-outline', label: 'Afternoon (12pm–6pm)' },
  { key: 'works_evening',   icon: 'moon-outline',         label: 'Evening (6pm–10pm)' },
  { key: 'works_night',     icon: 'cloudy-night-outline', label: 'Night (10pm–6am)' },
];

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function PublicDriverProfileScreen() {
  const { driverId } = useLocalSearchParams();
  const router = useRouter();

  const [driver, setDriver]       = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [stats, setStats]         = useState<any>({ averageRating: 0, totalFeedbacks: 0 });
  const [showAll, setShowAll]     = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const [profileRes] = await Promise.all([
        axios.get(`${API_URL}/drivers/${driverId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setDriver(profileRes.data.data);

      // Load reviews & stats in parallel
      const [statsRes, feedRes] = await Promise.all([
        getPublicDriverStats(String(driverId)),
        getPublicDriverFeedback(String(driverId), 1, 20),
      ]);
      setStats(statsRes.data);
      setFeedbacks(feedRes.data || []);

      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    } catch (e) {
      console.error('Error fetching driver profile:', e);
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
        <Ionicons name="alert-circle-outline" size={48} color="#DDD" />
        <Text style={styles.errorText}>Driver not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const vehicule  = driver.vehicules?.[0];
  const prefs     = driver.preferences ?? driver;
  const avgRating = Number(stats?.averageRating || driver.stats?.avgRating || 0);
  const totalReviews = stats?.totalFeedbacks || driver.stats?.ratingsCount || 0;

  // Only active prefs / hours
  const activePrefs = PREF_CONFIG.filter(p => prefs?.[p.key]);
  const activeHours = HOURS_CONFIG.filter(h => prefs?.[h.key]);

  // Reviews to show
  const visibleFeedbacks = showAll ? feedbacks : feedbacks.slice(0, 3);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>

        {/* ── HEADER ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
            <Ionicons name="close" size={22} color="#111" />
          </TouchableOpacity>
          <View style={{ width: 40 }} />
        </View>

        <Animated.ScrollView style={{ opacity: fadeAnim }} contentContainerStyle={styles.content}>

          {/* ── AVATAR + NAME ── */}
          <View style={styles.heroSection}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={44} color="#FFF" />
            </View>
            <Text style={styles.name}>{driver.prenom} {driver.nom}</Text>
            {driver.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                <Text style={styles.verifiedText}>Verified Driver</Text>
              </View>
            )}
          </View>

          {/* ── STATS ROW ── */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{driver.stats?.totalRides ?? '—'}</Text>
              <Text style={styles.statLabel}>rides</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.statNumber}>{avgRating.toFixed(1)}</Text>
                <Ionicons name="star" size={16} color="#CA8A04" />
              </View>
              <Text style={styles.statLabel}>rating</Text>
            </View>
          </View>

          {/* ── VEHICLE ── */}
          {vehicule && (
            <View style={styles.vehicleRow}>
              <View>
                <Text style={styles.vehicleModel}>
                  {[vehicule.couleur, vehicule.marque, vehicule.modele, vehicule.annee ? `, ${vehicule.annee}` : ''].filter(Boolean).join(' ')}
                </Text>
                {vehicule.plaque && (
                  <View style={styles.plateBox}>
                    <Text style={styles.plateText}>{vehicule.plaque}</Text>
                  </View>
                )}
              </View>
              <Ionicons name="car-outline" size={40} color="#CCC" />
            </View>
          )}

          {/* ── PREFERENCES (only YES) ── */}
          {activePrefs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Preferences</Text>
              <View style={styles.chipsWrap}>
                {activePrefs.map(p => (
                  <View key={p.key} style={styles.prefChip}>
                    <Ionicons name={p.icon as any} size={15} color="#111" />
                    <Text style={styles.prefChipText}>{p.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── WORKING HOURS (only ON) ── */}
          {activeHours.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Working Hours</Text>
              <View style={styles.chipsWrap}>
                {activeHours.map(h => (
                  <View key={h.key} style={styles.hourChip}>
                    <Ionicons name={h.icon as any} size={15} color="#555" />
                    <Text style={styles.hourChipText}>{h.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── REVIEWS (inline) ── */}
          {feedbacks.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{totalReviews} review{totalReviews !== 1 ? 's' : ''}</Text>

              {visibleFeedbacks.map(fb => (
                <View key={fb.id} style={styles.reviewRow}>
                  <StarRow rating={fb.rating} />
                  {fb.comment ? (
                    <Text style={styles.reviewComment}>{fb.comment}</Text>
                  ) : null}
                  <Text style={styles.reviewMeta}>
                    {fb.trajet?.passenger?.prenom} · {formatTimeAgo(fb.createdAt)}
                  </Text>
                </View>
              ))}

              {feedbacks.length > 3 && (
                <TouchableOpacity
                  style={styles.seeAllBtn}
                  onPress={() => setShowAll(s => !s)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeAllText}>{showAll ? 'Show less' : 'See all'}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

        </Animated.ScrollView>
      </SafeAreaView>
    </>
  );
}

// ─────────────────────────────────────────────
// TIME AGO HELPER
// ─────────────────────────────────────────────
function formatTimeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 7)  return `${days} days ago`;
  if (days < 14) return '1 week ago';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return '1 month ago';
  return `${Math.floor(days / 30)} months ago`;
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#fff' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', gap: 12 },
  loadingText: { fontSize: 15, color: '#666' },
  errorText:   { fontSize: 15, color: '#666' },
  backBtn:     { backgroundColor: '#111', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  backBtnText: { color: '#FFF', fontWeight: '700' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerBack: { width: 40 },

  content: { paddingHorizontal: 20, paddingBottom: 48 },

  // Hero
  heroSection: { alignItems: 'center', paddingTop: 8, paddingBottom: 20 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  name:          { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 6 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifiedText:  { fontSize: 12, fontWeight: '600', color: '#22C55E' },

  // Stats
  statsRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F0F0F0',
    paddingVertical: 16, marginBottom: 20,
  },
  statBox:     { alignItems: 'center', paddingHorizontal: 32 },
  statNumber:  { fontSize: 22, fontWeight: '800', color: '#111' },
  statLabel:   { fontSize: 12, color: '#888', marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: '#E5E7EB' },

  // Vehicle
  vehicleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F7F7F7', borderRadius: 14, padding: 16, marginBottom: 20,
  },
  vehicleModel: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 6 },
  plateBox:     { borderWidth: 1, borderColor: '#DDD', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  plateText:    { fontSize: 12, fontWeight: '600', color: '#444', letterSpacing: 1 },

  // Section
  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 12 },

  // Preference chips
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prefChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F0F0F0', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  prefChipText: { fontSize: 13, fontWeight: '600', color: '#111' },
  hourChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F7F7F7', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  hourChipText: { fontSize: 13, fontWeight: '500', color: '#555' },

  // Reviews
  reviewRow:     { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  reviewComment: { fontSize: 14, color: '#111', marginTop: 4, lineHeight: 20 },
  reviewMeta:    { fontSize: 12, color: '#999', marginTop: 4 },

  seeAllBtn: {
    marginTop: 12, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#F5F5F5', alignItems: 'center',
  },
  seeAllText: { fontSize: 14, fontWeight: '700', color: '#111' },
});