import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Animated,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../../services/api";
import {
  getPublicDriverStats,
  getPublicDriverFeedback,
} from "../../services/feedbackService";

// ─────────────────────────────────────────────
// AVATAR COLOR — blue for male, pink for female
// ─────────────────────────────────────────────
function getAvatarColor(gender?: string): { bg: string; text: string } {
  if (gender === "female" || gender === "femme" || gender === "F")
    return { bg: "#fad0e2", text: "#BE185D" };
  return { bg: "#d3e4fa", text: "#1B72DA" };
}

// ─────────────────────────────────────────────
// STAR ROW
// ─────────────────────────────────────────────
function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  const r = Math.round(parseFloat(String(rating)) * 2) / 2;
  const floored = Math.floor(r);
  const hasHalf = r - floored === 0.5;
  return (
    <View style={{ flexDirection: "row" }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const full = i <= floored;
        const half = !full && hasHalf && i === floored + 1;
        return (
          <Ionicons
            key={i}
            name={full ? "star" : half ? "star-half" : "star-outline"}
            size={size}
            color={full || half ? "#F59E0B" : "#D1D5DB"}
            style={{ marginRight: 2 }}
          />
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────
// CONFIGS
// ─────────────────────────────────────────────
const PREF_CONFIG = [
  { key: "talkative", icon: "chatbubbles-outline", label: "Talkative" },
  { key: "radio_on", icon: "musical-notes-outline", label: "Radio" },
  { key: "smoking_allowed", icon: "flame-outline", label: "Smoking" },
  { key: "pets_allowed", icon: "paw-outline", label: "Pets" },
  { key: "car_big", icon: "briefcase-outline", label: "Large bags" },
];

const HOURS_CONFIG = [
  { key: "works_morning", icon: "sunny-outline", label: "Morning (6am–12pm)" },
  {
    key: "works_afternoon",
    icon: "partly-sunny-outline",
    label: "Afternoon (12pm–6pm)",
  },
  { key: "works_evening", icon: "moon-outline", label: "Evening (6pm–10pm)" },
  {
    key: "works_night",
    icon: "cloudy-night-outline",
    label: "Night (10pm–6am)",
  },
];

const HOUR_COLORS_MALE: Record<string, string> = {
  works_morning:   "#BFDBFE",
  works_afternoon: "#60A5FA",
  works_evening:   "#2563EB",
  works_night:     "#1E3A5F",
};

const HOUR_COLORS_FEMALE: Record<string, string> = {
  works_morning:   "#FBCFE8",
  works_afternoon: "#F472B6",
  works_evening:   "#DB2777",
  works_night:     "#831843",
};

const HOUR_TEXT_MALE: Record<string, string> = {
  works_morning:   "#1E3A5F",
  works_afternoon: "#1E3A5F",
  works_evening:   "#fff",
  works_night:     "#fff",
};

const HOUR_TEXT_FEMALE: Record<string, string> = {
  works_morning:   "#831843",
  works_afternoon: "#831843",
  works_evening:   "#fff",
  works_night:     "#fff",
};

const HOUR_SHORT: Record<string, string> = {
  works_morning:   "Morning",
  works_afternoon: "Afternoon",
  works_evening:   "Evening",
  works_night:     "Night",
};

const HOUR_TICK: Record<string, string> = {
  works_morning:   "6am–12pm",
  works_afternoon: "12pm–6pm",
  works_evening:   "6pm–10pm",
  works_night:     "10pm–6am",
};

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function PublicDriverProfileScreen() {
  const { driverId } = useLocalSearchParams();
  const router = useRouter();
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    averageRating: 0,
    totalFeedbacks: 0,
  });
  const [showAll, setShowAll] = useState(false);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchAll();
  }, []);

  // ✅ FIXED: fetchAll only fetches data and sets state — no JSX returned here
  const fetchAll = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const profileRes = await axios.get(`${API_URL}/drivers/${driverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDriver(profileRes.data.data);

      // Selfie
      try {
        const selfieRes = await axios.get(
          `${API_URL}/verification/driver/${driverId}/selfie`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (selfieRes.data.success) {
          setSelfieUrl(selfieRes.data.image);
        }
      } catch (e) {
        setSelfieUrl(null);
      }

      const [statsRes, feedRes] = await Promise.all([
        getPublicDriverStats(String(driverId)),
        getPublicDriverFeedback(String(driverId), 1, 20),
      ]);
      setStats(statsRes.data);
      setFeedbacks(feedRes.data || []);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } catch (e) {
      console.error("Error fetching driver profile:", e);
    } finally {
      setLoading(false);
    }
  }; // ✅ FIXED: fetchAll closes here

  // ✅ FIXED: Loading state is now in the component body
  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size='large' color='#111' />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  // ✅ FIXED: Not found state is now in the component body
  if (!driver) {
    return (
      <SafeAreaView style={styles.centered}>
        <Ionicons name='alert-circle-outline' size={48} color='#DDD' />
        <Text style={styles.errorText}>Driver not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const vehicule = driver.vehicules?.[0];
  // Backend returns preferences as nested object AND at top-level — check both
  const prefs = {
    talkative: driver.preferences?.talkative ?? driver.talkative,
    radio_on: driver.preferences?.radio_on ?? driver.radio_on,
    smoking_allowed:
      driver.preferences?.smoking_allowed ?? driver.smoking_allowed,
    pets_allowed: driver.preferences?.pets_allowed ?? driver.pets_allowed,
    car_big: driver.preferences?.car_big ?? driver.car_big,
    works_morning: driver.preferences?.works_morning ?? driver.works_morning,
    works_afternoon:
      driver.preferences?.works_afternoon ?? driver.works_afternoon,
    works_evening: driver.preferences?.works_evening ?? driver.works_evening,
    works_night: driver.preferences?.works_night ?? driver.works_night,
  };
  const avgRating = Number(
    stats?.averageRating || driver.stats?.avgRating || 0,
  );
  const totalReviews = stats?.totalFeedbacks || driver.stats?.ratingsCount || 0;

  const activePrefs = PREF_CONFIG.filter((p) => prefs?.[p.key as keyof typeof prefs]);
  const activeHours = HOURS_CONFIG.filter((h) => prefs?.[h.key as keyof typeof prefs]);
  const isFemale = ["F", "female", "femme"].includes(driver.gender ?? driver.genre ?? driver.sexe ?? "");
  const visibleFeedbacks = showAll ? feedbacks : feedbacks.slice(0, 3);

  const initials =
    `${driver.prenom?.[0] ?? ""}${driver.nom?.[0] ?? ""}`.toUpperCase();
  const avatarColor = getAvatarColor(
    driver.gender ?? driver.genre ?? driver.sexe,
  );

  // ✅ FIXED: Main JSX return is now in the component body
  return (
    <>
      <SafeAreaView style={styles.container}>
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {/* ── HERO ── */}
          <View style={styles.heroSection}>
            {/* Avatar + rating badge overlay */}
            <View style={styles.avatarWrap}>
              <View
                style={[styles.avatarRing, { borderColor: avatarColor.bg }]}>
                {selfieUrl ? (
                  <Image
                    source={{ uri: selfieUrl }}
                    style={{ width: 86, height: 86, borderRadius: 43 }}
                    onError={() => setSelfieUrl(null)}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: avatarColor.bg },
                    ]}>
                    <Text
                      style={[styles.avatarText, { color: avatarColor.text }]}>
                      {initials}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Name */}
            <Text style={styles.name}>
              {driver.prenom} {driver.nom}
            </Text>

            {/* DRIVER badge */}
            <View style={styles.driverBadge}>
              <Text style={styles.driverBadgeText}>DRIVER</Text>
            </View>

            {/* Verified */}
            {driver.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name='checkmark-circle' size={13} color='#22C55E' />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>

          {/* ── STATS CARDS ── */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {driver.stats?.completedRides ?? "—"}
              </Text>
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
                  <Ionicons name='car-outline' size={26} color='#111' />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleModel}>
                    {[vehicule.marque, vehicule.modele]
                      .filter(Boolean)
                      .join(" ")}
                  </Text>
                  <Text style={styles.vehicleColor}>
                    {vehicule.couleur ?? ""}
                    {vehicule.annee ? `  ·  ${vehicule.annee}` : ""}
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
                {activePrefs.map((p) => (
                  <View key={p.key} style={styles.prefChip}>
                    <Ionicons name={p.icon as any} size={13} color='#111' />
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
              <View style={styles.timelineWrap}>
                {activeHours.map((h) => (
                  <View key={h.key} style={[styles.timelineSegment, { backgroundColor: isFemale ? HOUR_COLORS_FEMALE[h.key] : HOUR_COLORS_MALE[h.key] }]}>
                    <Text style={[styles.timelineLabel, { color: isFemale ? HOUR_TEXT_FEMALE[h.key] : HOUR_TEXT_MALE[h.key] }]} numberOfLines={1}>{HOUR_SHORT[h.key]}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.timelineTicks}>
                {activeHours.map((h) => (
                  <Text key={h.key} style={styles.timelineTick}>{HOUR_TICK[h.key]}</Text>
                ))}
              </View>
            </View>
          )}

          {/* ── REVIEWS ── */}
          {feedbacks.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reviews</Text>

              {visibleFeedbacks.map((fb, idx) => (
                <View
                  key={fb.id}
                  style={[styles.reviewCard, idx === 0 && { marginTop: 0 }]}>
                  {/* Reviewer initials */}
                  {(() => {
                    const passengerGender = fb.trajet?.passenger?.sexe ?? fb.trajet?.passenger?.genre ?? fb.trajet?.passenger?.gender;
                    const pColor = getAvatarColor(passengerGender);
                    // If no gender info → grey
                    const bg   = passengerGender ? pColor.bg   : "#E5E7EB";
                    const text = passengerGender ? pColor.text : "#6B7280";
                    return (
                      <View style={[styles.reviewAvatar, { backgroundColor: bg }]}>
                        <Text style={[styles.reviewAvatarText, { color: text }]}>
                          {fb.trajet?.passenger?.prenom?.[0]?.toUpperCase() ?? "?"}
                        </Text>
                      </View>
                    );
                  })()}
                  <View style={{ flex: 1 }}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewerName}>
                        {fb.trajet?.passenger?.prenom ?? "Passenger"}
                      </Text>
                      <Text style={styles.reviewTime}>
                        {formatTimeAgo(fb.createdAt)}
                      </Text>
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
                  onPress={() => setShowAll((s) => !s)}
                  activeOpacity={0.7}>
                  <Text style={styles.seeAllText}>
                    {showAll ? "Show less" : "See all reviews"}
                  </Text>
                  <Ionicons
                    name={showAll ? "chevron-up" : "chevron-down"}
                    size={15}
                    color='#111'
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
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 8,
  },
  backBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#111",
    borderRadius: 10,
  },
  backBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  content: {
    paddingBottom: 40,
  },
  // ── Hero ──
  heroSection: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  avatarWrap: {
    marginBottom: 12,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "700",
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
    marginBottom: 6,
  },
  driverBadge: {
    backgroundColor: "#111",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 6,
  },
  driverBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: "#22C55E",
    fontWeight: "600",
    marginLeft: 4,
  },
  // ── Stats ──
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginRight: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
  },
  statLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
    marginTop: 4,
  },
  // ── Section ──
  section: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  // ── Vehicle ──
  vehicleCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  vehicleIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  vehicleModel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
  },
  vehicleColor: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  plateBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  plateText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    letterSpacing: 1,
  },
  // ── Chips ──
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  prefChip: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  prefChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#111",
    marginLeft: 5,
  },
  timelineWrap: {
    flexDirection: "row",
    borderRadius: 10,
    overflow: "hidden",
    height: 36,
  },
  timelineSegment: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  timelineTicks: {
    flexDirection: "row",
    marginTop: 5,
  },
  timelineTick: {
    flex: 1,
    fontSize: 10,
    color: "#9CA3AF",
    textAlign: "center",
  },
  // ── Reviews ──
  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    marginTop: 10,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  reviewAvatar: {
    marginRight: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  reviewAvatarText: {
    fontSize: 14,
    fontWeight: "700",
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111",
  },
  reviewTime: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  reviewComment: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
    marginTop: 4,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111",
    marginRight: 4,
  },
});

// ─────────────────────────────────────────────
// TIME AGO
// ─────────────────────────────────────────────
function formatTimeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "1 month ago";
  return `${Math.floor(days / 30)} months ago`;
}
