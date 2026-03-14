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
// AVATAR COLOR — blue for male, pink for female
// ─────────────────────────────────────────────
function getAvatarColor(gender?: string) {
  if (gender === 'female' || gender === 'femme' || gender === 'F') return '#F472B6';
  return '#60A5FA'; // default = male
}

// ─────────────────────────────────────────────
// STAR ROW
// ─────────────────────────────────────────────
function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={i <= Math.round(rating) ? '#CA8A04' : '#D1D5DB'}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
// CONFIGS
// ─────────────────────────────────────────────
const PREF_CONFIG = [
  { key: 'talkative',       icon: 'chatbubbles-outline',   label: 'Talkative' },
  { key: 'radio_on',        icon: 'musical-notes-outline', label: 'Radio' },
  { key: 'smoking_allowed', icon: 'flame-outline',         label: 'Smoking OK' },
  { key: 'pets_allowed',    icon: 'paw-outline',           label: 'Pets' },
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
      const profileRes = await axios.get(`${API_URL}/drivers/${driverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDriver(profileRes.data.data);

      const [statsRes, feedRes] = await Promise.all([
        getPublicDriverStats(String(driverId)),
        getPublicDriverFeedback(String(driverId), 1, 20),
      ]);
      setStats(statsRes.data);
      setFeedbacks(feedRes.data || []);

      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (e) {
      console.error('Error fetching driver profile:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#111" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  // ── Not found ──
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

  const vehicule     = driver.vehicules?.[0];
  const prefs        = driver.preferences ?? driver;
  const avgRating    = Number(stats?.averageRating || driver.stats?.avgRating || 0);
  const totalReviews = stats?.totalFeedbacks || driver.stats?.ratingsCount || 0;

  const activePrefs = PREF_CONFIG.filter(p => prefs?.[p.key]);
  const activeHours = HOURS_CONFIG.filter(h => prefs?.[h.key]);
  const visibleFeedbacks = showAll ? feedbacks : feedbacks.slice(0, 3);

  const initials = `${driver.prenom?.[0] ?? ''}${driver.nom?.[0] ?? ''}`.toUpperCase();
  const avatarBg = getAvatarColor(driver.gender ?? driver.genre ?? driver.sexe);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>

        {/* ── TOP NAV ── */}
        <View style={styles.topNav}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={20} color="#111" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Driver Profile</Text>
          <View style={styles.navBtn} />
        </View>

        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ── HERO ── */}
          <View style={styles.heroSection}>
            {/* Avatar + rating badge overlay */}
            <View style={styles.avatarWrap}>
              <View style={[styles.avatarRing, { borderColor: avatarBg }]}>
                <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              </View>

            </View>

            {/* Name */}
            <Text style={styles.name}>{driver.prenom} {driver.nom}</Text>

            {/* DRIVER badge */}
            <View style={styles.driverBadge}>
              <Text style={styles.driverBadgeText}>DRIVER</Text>
            </View>

            {/* Verified */}
            {driver.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={13} color="#22C55E" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>

          {/* ── STATS CARDS ── */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{driver.stats?.totalRides ?? '—'}</Text>
              <Text style={styles.statLabel}>Rides</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{avgRating.toFixed(1)}</Text>
              <StarRow rating={avgRating} size={12} />
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{totalReviews}</Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </View>
          </View>

          {/* ── VEHICLE ── */}
          {vehicule && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vehicle</Text>
              <View style={styles.vehicleCard}>
                <View style={styles.vehicleIconWrap}>
                  <Ionicons name="car-outline" size={26} color="#111" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleModel}>
                    {[vehicule.marque, vehicule.modele].filter(Boolean).join(' ')}
                  </Text>
                  <Text style={styles.vehicleColor}>
                    {vehicule.couleur ?? ''}
                    {vehicule.annee ? `  ·  ${vehicule.annee}` : ''}
                  </Text>
                </View>
                {vehicule.plaque && (
                  <View style={styles.plateBox}>
                    <Text style={styles.plateText}>{vehicule.plaque}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── PREFERENCES ── */}
          {activePrefs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Preferences</Text>
              <View style={styles.chipsWrap}>
                {activePrefs.map(p => (
                  <View key={p.key} style={styles.prefChip}>
                    <Ionicons name={p.icon as any} size={13} color="#111" />
                    <Text style={styles.prefChipText}>{p.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── WORKING HOURS ── */}
          {activeHours.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Working Hours</Text>
              <View style={styles.chipsWrap}>
                {activeHours.map(h => (
                  <View key={h.key} style={styles.hourChip}>
                    <Ionicons name={h.icon as any} size={13} color="#555" />
                    <Text style={styles.hourChipText}>{h.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── REVIEWS ── */}
          {feedbacks.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reviews</Text>

              {visibleFeedbacks.map((fb, idx) => (
                <View key={fb.id} style={[styles.reviewCard, idx === 0 && { marginTop: 0 }]}>
                  {/* Reviewer initials */}
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>
                      {fb.trajet?.passenger?.prenom?.[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewerName}>
                        {fb.trajet?.passenger?.prenom ?? 'Passenger'}
                      </Text>
                      <Text style={styles.reviewTime}>{formatTimeAgo(fb.createdAt)}</Text>
                    </View>
                    <StarRow rating={fb.rating} size={12} />
                    {fb.comment ? (
                      <Text style={styles.reviewComment}>{fb.comment}</Text>
                    ) : null}
                  </View>
                </View>
              ))}

              {feedbacks.length > 3 && (
                <TouchableOpacity
                  style={styles.seeAllBtn}
                  onPress={() => setShowAll(s => !s)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeAllText}>{showAll ? 'Show less' : 'See all reviews'}</Text>
                  <Ionicons
                    name={showAll ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color="#111"
                  />
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
// TIME AGO
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
  container:   { flex: 1, backgroundColor: '#FAFAFA' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA', gap: 12 },
  loadingText: { fontSize: 14, color: '#888', marginTop: 8 },
  errorText:   { fontSize: 15, color: '#888' },
  backBtn:     { backgroundColor: '#111', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  backBtnText: { color: '#FFF', fontWeight: '700' },

  // Top nav
  topNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FAFAFA',
  },
  navBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 15, fontWeight: '700', color: '#111' },

  content: { paddingHorizontal: 20, paddingBottom: 48 },

  // ── Hero ──
  heroSection: { alignItems: 'center', paddingTop: 12, paddingBottom: 28 },

  avatarWrap: {
    position: 'relative',
    marginBottom: 18,
    alignItems: 'center',
  },
  avatarRing: {
    width: 92, height: 92, borderRadius: 46,
    borderWidth: 3, padding: 3,
  },
  avatar: {
    flex: 1, borderRadius: 43,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '900', color: '#FFF' },

  // Rating pill — overlaps bottom of avatar
  ratingPill: {
    position: 'absolute',
    bottom: -13,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 2, borderColor: '#FFF',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  ratingValue: { fontSize: 13, fontWeight: '800', color: '#B45309' },
  ratingDot:   { fontSize: 14, color: '#CA8A04', fontWeight: '600' },
  ratingCount: { fontSize: 14, fontWeight: '600', color: '#92400E' },

  name: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 8, letterSpacing: -0.3 },
  driverBadge: {
    backgroundColor: '#111', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5,
    marginBottom: 10,
  },
  driverBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF', letterSpacing: 1.5 },

  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText:  { fontSize: 12, fontWeight: '600', color: '#22C55E' },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row', gap: 10, marginBottom: 24,
  },
  statCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statNumber: { fontSize: 20, fontWeight: '800', color: '#111' },
  statLabel:  { fontSize: 12, color: '#9CA3AF', marginTop: 3, fontWeight: '500' },

  // ── Section ──
  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111', marginBottom: 12, letterSpacing: -0.2 },

  // ── Vehicle card ──
  vehicleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  vehicleIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  vehicleModel: { fontSize: 14, fontWeight: '700', color: '#111' },
  vehicleColor: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  plateBox: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#F9FAFB',
  },
  plateText: { fontSize: 12, fontWeight: '700', color: '#374151', letterSpacing: 1.2 },

  // ── Chips ──
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prefChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF', borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 12, paddingVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  prefChipText: { fontSize: 12, fontWeight: '600', color: '#111' },
  hourChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F9FAFB', borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  hourChipText: { fontSize: 12, fontWeight: '500', color: '#555' },

  // ── Review cards ──
  reviewCard: {
    flexDirection: 'row', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    marginTop: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarText: { fontSize: 14, fontWeight: '800', color: '#555' },
  reviewHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewerName:     { fontSize: 13, fontWeight: '700', color: '#111' },
  reviewTime:       { fontSize: 11, color: '#9CA3AF' },
  reviewComment:    { fontSize: 13, color: '#374151', lineHeight: 18, marginTop: 2 },

  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 12, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB',
  },
  seeAllText: { fontSize: 14, fontWeight: '700', color: '#111' },
});