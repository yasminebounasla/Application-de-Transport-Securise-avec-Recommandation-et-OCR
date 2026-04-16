// MyFeedbacksScreen.tsx
import {
  View,
  ScrollView,
  Text,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { useState, useEffect } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import RatingStars from '../../components/RatingStars';
import { getDriverStats, getDriverFeedback } from '../../services/feedbackService';

interface Feedback {
  id: number;
  rating: number;
  comment?: string;
  createdAt: string;
  trajet: {
    startAddress?: string;
    endAddress?: string;
    depart?: string;
    destination?: string;
    passenger: {
      prenom: string;
      nom: string;
    };
  };
}

interface Stats {
  averageRating: number;
  totalFeedbacks: number;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
}

function getRouteAddresses(trajet: Feedback['trajet']) {
  const start = trajet.startAddress || trajet.depart || 'Unknown departure';
  const end = trajet.endAddress || trajet.destination || 'Unknown destination';
  return { start, end };
}

/** Returns how many feedbacks fall on each star level 1–5 */
function computeBarCounts(feedbacks: Feedback[], totalFeedbacks: number) {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  feedbacks.forEach(f => {
    const r = Math.round(f.rating);
    if (r >= 1 && r <= 5) counts[r]++;
  });
  return counts;
}

export default function MyFeedbacksScreen() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<Stats>({ averageRating: 0, totalFeedbacks: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    totalPages: 1,
    hasNextPage: false,
  });

  const loadStats = async () => {
    try {
      const response = await getDriverStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadFeedbacks = async (page = 1, append = false) => {
    try {
      page === 1 ? setLoading(true) : setLoadingMore(true);
      const response = await getDriverFeedback(page, 10);
      const newFeedbacks = response.data;
      setFeedbacks(prev => (append ? [...prev, ...newFeedbacks] : newFeedbacks));
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error loading feedbacks:', error);
      Alert.alert('Error', 'Unable to load reviews');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const loadMore = () => {
    if (pagination.hasNextPage && !loadingMore) {
      loadFeedbacks(pagination.currentPage + 1, true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    await loadFeedbacks(1);
  };

  useEffect(() => {
    loadStats();
    loadFeedbacks(1);
  }, []);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const positiveRate =
    stats.totalFeedbacks > 0
      ? Math.round(
          (feedbacks.filter(f => f.rating >= 4).length / stats.totalFeedbacks) * 100,
        )
      : 0;

  const barCounts = computeBarCounts(feedbacks, stats.totalFeedbacks);
  const maxBarCount = Math.max(...Object.values(barCounts), 1);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111" />
      }
    >
      {/* ── HERO CARD ── */}
      <View style={styles.card}>
        <Text style={styles.eyebrow}>My reviews</Text>
        <Text style={styles.heroTitle}>Passenger feedback</Text>
        <Text style={styles.heroSub}>
          Ratings and comments left by your passengers after each ride.
        </Text>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{stats.averageRating.toFixed(1)}</Text>
            <Text style={styles.statLbl}>Avg. rating</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{stats.totalFeedbacks}</Text>
            <Text style={styles.statLbl}>Total reviews</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{positiveRate}%</Text>
            <Text style={styles.statLbl}>Positive</Text>
          </View>
        </View>

        {/* Rating breakdown */}
        <View style={styles.ratingRow}>
          {/* Left: big number + stars */}
          <View style={styles.ratingLeft}>
            <Text style={styles.ratingBig}>{stats.averageRating.toFixed(1)}</Text>
            <RatingStars rating={stats.averageRating} size={18} showValue={false} />
            <Text style={styles.ratingCount}>{stats.totalFeedbacks} reviews</Text>
          </View>

          {/* Right: bar breakdown per star */}
          <View style={styles.barsCol}>
            {[5, 4, 3, 2, 1].map(star => {
              const count = barCounts[star] ?? 0;
              const pct = (count / maxBarCount) * 100;
              return (
                <View key={star} style={styles.barRow}>
                  <Text style={styles.barLbl}>{star}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${pct}%` as any },
                        star <= 2 && styles.barFillLow,
                      ]}
                    />
                  </View>
                  <Text style={styles.barCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* ── FEEDBACK LIST ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Passenger comments</Text>
        <Text style={styles.sectionSub}>Your latest feedback after each ride.</Text>

        {feedbacks.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="chat-bubble-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptySub}>Your reviews will appear here</Text>
          </View>
        ) : (
          <>
            {feedbacks.map(feedback => {
              const { start, end } = getRouteAddresses(feedback.trajet);
              return (
                <View key={feedback.id} style={styles.fbItem}>
                  {/* Header */}
                  <View style={styles.fbHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fbName}>
                        {feedback.trajet.passenger.prenom} {feedback.trajet.passenger.nom}
                      </Text>
                      <View style={{ marginTop: 4 }}>
                        <RatingStars rating={feedback.rating} size={14} showValue={false} />
                      </View>
                    </View>
                    <View style={styles.dateBadge}>
                      <Text style={styles.dateText}>{formatDate(feedback.createdAt)}</Text>
                    </View>
                  </View>

                  {/* Comment */}
                  {feedback.comment && (
                    <View style={styles.commentBox}>
                      <Text style={styles.commentText}>"{feedback.comment}"</Text>
                    </View>
                  )}

                  {/* Route */}
                  <View style={styles.routeRow}>
                    <View style={styles.routeDot} />
                    <Text style={styles.routeTxt} numberOfLines={1}>{start}</Text>
                    <MaterialIcons name="arrow-forward" size={12} color="#9CA3AF" />
                    <View style={[styles.routeDot, styles.routeDotEnd]} />
                    <Text style={styles.routeTxt} numberOfLines={1}>{end}</Text>
                  </View>
                </View>
              );
            })}

            {pagination.hasNextPage && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={loadMore}
                disabled={loadingMore}
                activeOpacity={0.82}
              >
                {loadingMore ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loadMoreText}>Load more reviews</Text>
                )}
              </TouchableOpacity>
            )}

            {!pagination.hasNextPage && feedbacks.length > 0 && (
              <View style={styles.endMsg}>
                <View style={styles.endLine} />
                <Text style={styles.endText}>All reviews loaded</Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F7F5' },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F5' },

  // Shared card
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 0.5,
    borderColor: '#E8E8E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },

  // Hero
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#F59E0B',
    marginBottom: 6,
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#111' },
  heroSub: { fontSize: 13, color: '#888', lineHeight: 19, marginTop: 5 },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  statBox: {
    flex: 1,
    backgroundColor: '#F5F5F3',
    borderRadius: 16,
    padding: 12,
  },
  statVal: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 2 },
  statLbl: { fontSize: 11, color: '#888', fontWeight: '500' },

  // Rating breakdown
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 0.5,
    borderTopColor: '#E8E8E5',
  },
  ratingLeft: { alignItems: 'center', minWidth: 68 },
  ratingBig: { fontSize: 36, fontWeight: '700', color: '#111', lineHeight: 40 },
  ratingCount: { fontSize: 11, color: '#888', marginTop: 5, fontWeight: '500' },

  barsCol: { flex: 1, gap: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  barLbl: { fontSize: 11, color: '#888', width: 10, textAlign: 'right' },
  barTrack: {
    flex: 1,
    height: 5,
    backgroundColor: '#F0F0EE',
    borderRadius: 99,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: '#111', borderRadius: 99 },
  barFillLow: { backgroundColor: '#D0D0CE' },
  barCount: { fontSize: 11, color: '#888', width: 18, textAlign: 'right' },

  // Section
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  sectionSub: { fontSize: 12, color: '#888', marginTop: 3, marginBottom: 14 },

  // Feedback item
  fbItem: {
    borderWidth: 0.5,
    borderColor: '#E8E8E5',
    borderRadius: 18,
    padding: 14,
    gap: 10,
    marginBottom: 10,
  },
  fbHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  fbName: { fontSize: 14, fontWeight: '700', color: '#111' },
  dateBadge: {
    backgroundColor: '#F5F5F3',
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  dateText: { fontSize: 11, color: '#888', fontWeight: '500' },

  // Comment
  commentBox: {
    backgroundColor: '#F5F5F3',
    borderRadius: 12,
    padding: 11,
  },
  commentText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // Route
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#E8E8E5',
  },
  routeDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: '#111', flexShrink: 0 },
  routeDotEnd: { backgroundColor: '#C8C8C6' },
  routeTxt: { fontSize: 12, color: '#888', fontWeight: '500', flex: 1 },

  // Load more
  loadMoreBtn: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  loadMoreText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 36, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  emptySub: { fontSize: 13, color: '#888' },

  // End
  endMsg: { alignItems: 'center', paddingVertical: 14, gap: 6 },
  endLine: { width: 40, height: 0.5, backgroundColor: '#E0E0DE' },
  endText: { fontSize: 12, color: '#AAA', fontWeight: '500' },
});
