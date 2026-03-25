import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Animated, Modal, Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = [
  { key: 'completed', label: 'Completed' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'cancelled', label: 'Cancelled' },
];
const PRICE_FILTERS = [
  { key: 'none', label: 'None' },
  { key: 'asc', label: 'Low-High' },
  { key: 'desc', label: 'High-Low' },
];
const NAME_FILTERS = [
  { key: 'none', label: 'None' },
  { key: 'az', label: 'A-Z' },
  { key: 'za', label: 'Z-A' },
];

const getDriverName = (ride: any) =>
  `${ride.driver?.prenom || ''} ${ride.driver?.nom || ''}`.trim();

function HighlightCard({ highlighted, children }: { highlighted: boolean; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!highlighted) { anim.setValue(0); return; }
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.delay(1500),
      Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: false }),
    ]).start();
  }, [anim, highlighted]);
  const bgColor = anim.interpolate({ inputRange: [0, 1], outputRange: ['#FFFFFF', '#FFF3CD'] });
  const borderColor = anim.interpolate({ inputRange: [0, 1], outputRange: ['#E5E7EB', '#F59E0B'] });
  return (
    <Animated.View style={[styles.rideCard, { backgroundColor: bgColor, borderColor }]}>
      {children}
    </Animated.View>
  );
}

export default function ActivityScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ rideId?: string; tab?: string }>();
  const router = useRouter();

  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('completed');
  const [showFilters, setShowFilters] = useState(false);
  const [priceFilter, setPriceFilter] = useState('none');
  const [nameFilter, setNameFilter] = useState('none');
  const [nameQuery, setNameQuery] = useState('');
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const pendingHighlight = useRef<{ rideId: number; tab: string } | null>(null);

  const loadActivity = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      setError('');
      const response = await api.get(`/rides/activity/passenger/${user.id}`);
      setActivity(response?.data?.data || []);
    } catch {
      setError("Impossible de charger l'activite.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadActivity(); }, [loadActivity]);

  // Step 1 : quand les params changent, sauvegarder la cible et switcher le tab
  useEffect(() => {
    if (!params.rideId) return;
    const rideId = parseInt(params.rideId as string);
    const tab = (params.tab as string) || 'pending';
    pendingHighlight.current = { rideId, tab };
    setActiveCategory(tab);
  }, [params.rideId, params.tab]);

  // Step 2 : quand activity est chargé et qu'on a un highlight en attente, appliquer
  useEffect(() => {
    if (activity.length === 0) return;
    if (!pendingHighlight.current) return;

    const { rideId, tab } = pendingHighlight.current;
    const ride = activity.find((r: any) => r.rideId === rideId);
    if (!ride) return;

    pendingHighlight.current = null;

    setActiveCategory(tab);
    setHighlightedId(rideId);

    setTimeout(() => {
      const tabRides = activity.filter((r: any) => {
        if (tab === 'completed') return r.status === 'COMPLETED';
        if (tab === 'pending') return r.status === 'PENDING';
        if (tab === 'accepted') return ['ACCEPTED', 'IN_PROGRESS'].includes(r.status);
        return ['CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER'].includes(r.status);
      });
      const index = tabRides.findIndex((r: any) => r.rideId === rideId);
      if (index >= 0) {
        flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
      }
    }, 400);

    setTimeout(() => setHighlightedId(null), 4500);
  }, [activity]);

  const categorized = useMemo(() => ({
    completed: activity.filter((r: any) => r.status === 'COMPLETED'),
    pending: activity.filter((r: any) => r.status === 'PENDING'),
    accepted: activity.filter((r: any) => ['ACCEPTED', 'IN_PROGRESS'].includes(r.status)),
    cancelled: activity.filter((r: any) => ['CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER'].includes(r.status)),
  }), [activity]);

  const visibleRides = useMemo(() => {
    let rides: any[] = (categorized as any)[activeCategory] || [];
    if (nameQuery.trim()) {
      const q = nameQuery.trim().toLowerCase();
      rides = rides.filter((ride: any) => getDriverName(ride).toLowerCase().includes(q));
    }
    rides = [...rides];
    if (nameFilter === 'az') rides.sort((a: any, b: any) => getDriverName(a).localeCompare(getDriverName(b)));
    if (nameFilter === 'za') rides.sort((a: any, b: any) => getDriverName(b).localeCompare(getDriverName(a)));
    if (priceFilter === 'asc') rides.sort((a: any, b: any) => (Number(a.prix) || 0) - (Number(b.prix) || 0));
    if (priceFilter === 'desc') rides.sort((a: any, b: any) => (Number(b.prix) || 0) - (Number(a.prix) || 0));
    return rides;
  }, [activeCategory, categorized, nameFilter, priceFilter, nameQuery]);

  const getStatusBadgeStyle = (status: string) => {
    if (status === 'COMPLETED') return styles.completedBadge;
    if (status === 'CANCELLED_BY_DRIVER') return styles.cancelledDriverBadge;
    if (status === 'CANCELLED_BY_PASSENGER') return styles.cancelledPassengerBadge;
    if (status === 'ACCEPTED') return styles.acceptedBadge;
    return styles.pendingBadge;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'CANCELLED_BY_DRIVER') return 'CANCELLED BY DRIVER';
    if (status === 'CANCELLED_BY_PASSENGER') return 'CANCELLED BY YOU';
    return status;
  };

  const renderItem = ({ item }: { item: any }) => {
    const dateLabel = item.dateDepart ? new Date(item.dateDepart).toLocaleDateString() : 'N/A';
    const timeLabel = item.heureDepart || 'N/A';
    const start = item.startAddress || item.depart || 'N/A';
    const end = item.endAddress || item.destination || 'N/A';
    const isHighlighted = item.rideId === highlightedId;
    const driver = item.driver || {};
    const driverName = `${driver.prenom || 'Unknown'} ${driver.nom || 'Driver'}`.trim();
    const driverPhone = driver.numTel ? String(driver.numTel) : 'N/A';

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() =>
          router.push(`/shared/ride-details/${item.rideId}` as any)
        }
      >
        <HighlightCard highlighted={isHighlighted}>
          <View style={styles.pendingHeader}>
            <View style={styles.pendingPassengerInfo}>
              <MaterialIcons name="account-circle" size={40} color="#111" />
              <View style={styles.pendingPassengerDetails}>
                <Text style={styles.pendingPassengerName}>{driverName}</Text>
                <Text style={styles.pendingPassengerPhone}>{driverPhone}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, getStatusBadgeStyle(item.status)]}>
              <Text style={[styles.statusText, item.status === 'ACCEPTED' && styles.acceptedText]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
          </View>
          <View style={styles.pendingSeparator} />
          <View style={styles.detailRow}><View style={styles.pendingStartDot} /><Text style={styles.detailText}>{start}</Text></View>
          <View style={styles.detailRow}><View style={styles.pendingEndDot} /><Text style={styles.detailText}>{end}</Text></View>
          <View style={styles.detailRow}><MaterialIcons name="event" size={18} color="#444" /><Text style={styles.detailText}>{dateLabel}</Text></View>
          <View style={styles.detailRow}><MaterialIcons name="schedule" size={18} color="#444" /><Text style={styles.detailText}>{timeLabel}</Text></View>
          <Text style={styles.seeMore}>See more infos</Text>
        </HighlightCard>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Chargement de vos trajets...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        onScrollToIndexFailed={() => {}}
        data={visibleRides}
        keyExtractor={(item: any) => String(item.rideId)}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            <View style={styles.categoriesRow}>
              {CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.key}
                  style={[styles.categoryButton, activeCategory === category.key && styles.categoryButtonActive]}
                  onPress={() => setActiveCategory(category.key)}
                >
                  <Text style={[styles.categoryText, activeCategory === category.key && styles.categoryTextActive]}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Liste trajets</Text>
              <View style={styles.sectionActions}>
                <TouchableOpacity
                  style={[styles.filterIconButton, showFilters && styles.filterIconButtonActive]}
                  onPress={() => setShowFilters(true)}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="filter-list" size={20} color={showFilters ? '#FFF' : '#111'} />
                </TouchableOpacity>
                <View style={styles.sectionCountBadge}>
                  <Text style={styles.sectionCountText}>{visibleRides.length}</Text>
                </View>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>.</Text>
            <Text style={styles.emptyText}>Aucun trajet dans cette categorie</Text>
            <Text style={styles.emptySubText}>Tirez vers le bas pour actualiser</Text>
          </View>
        }
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadActivity(); setRefreshing(false); }} colors={['#000']} />}
      />
      <Modal
        transparent
        animationType="fade"
        visible={showFilters}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowFilters(false)} />
          <View style={styles.filterModal}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filtrage</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="close" size={22} color="#111" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionLabel}>Price</Text>
            <View style={styles.filterChoicesWrap}>
              {PRICE_FILTERS.map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  style={[styles.filterChoiceButton, priceFilter === filter.key && styles.filterChoiceButtonActive]}
                  onPress={() => setPriceFilter(filter.key)}
                >
                  <Text style={[styles.filterChoiceText, priceFilter === filter.key && styles.filterChoiceTextActive]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionLabel}>A-Z / Z-A</Text>
            <View style={styles.filterChoicesWrap}>
              {NAME_FILTERS.map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  style={[styles.filterChoiceButton, nameFilter === filter.key && styles.filterChoiceButtonActive]}
                  onPress={() => setNameFilter(filter.key)}
                >
                  <Text style={[styles.filterChoiceText, nameFilter === filter.key && styles.filterChoiceTextActive]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionLabel}>Name of driver</Text>
            <TextInput
              style={styles.modalInput}
              value={nameQuery}
              onChangeText={setNameQuery}
              placeholder="Name of driver"
              placeholderTextColor="#9CA3AF"
            />

            <View style={styles.filterFooter}>
              <TouchableOpacity
                style={styles.filterResetButton}
                onPress={() => {
                  setPriceFilter('none');
                  setNameFilter('none');
                  setNameQuery('');
                }}
              >
                <Text style={styles.filterResetText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterDoneButton} onPress={() => setShowFilters(false)}>
                <Text style={styles.filterDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 15 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 28, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#666', marginBottom: 8 },
  emptySubText: { fontSize: 14, color: '#999' },
  errorBox: { marginHorizontal: 16, marginTop: 4, marginBottom: 8, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#FFF1F1', borderWidth: 1, borderColor: '#FFCACA' },
  errorText: { color: '#B42318', fontSize: 13, fontWeight: '600' },
  categoriesRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 8, gap: 8 },
  categoryButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB' },
  categoryButtonActive: { backgroundColor: '#111', borderColor: '#111' },
  categoryText: { color: '#111', fontSize: 13, fontWeight: '600' },
  categoryTextActive: { color: '#FFF' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 12, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterIconButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  filterIconButtonActive: { backgroundColor: '#111', borderColor: '#111' },
  sectionCountBadge: { minWidth: 38, height: 38, borderRadius: 12, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  sectionCountText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  listContainer: { paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 },
  rideCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, marginBottom: 12 },
  pendingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 },
  pendingPassengerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  pendingPassengerDetails: { marginLeft: 10, flex: 1 },
  pendingPassengerName: { color: '#111', fontSize: 16, fontWeight: '700' },
  pendingPassengerPhone: { color: '#666', fontSize: 13, marginTop: 2 },
  pendingSeparator: { height: 1, backgroundColor: '#E5E7EB', marginBottom: 12 },
  rideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rideId: { color: '#111', fontWeight: '700', fontSize: 14 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  completedBadge: { backgroundColor: '#D1FAE5' },
  pendingBadge: { backgroundColor: '#DBEAFE' },
  acceptedBadge: { backgroundColor: '#DCFCE7' },
  cancelledDriverBadge: { backgroundColor: '#FFEDD5' },
  cancelledPassengerBadge: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#111' },
  acceptedText: { color: '#166534' },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  pendingStartDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#111' },
  pendingEndDot: { width: 12, height: 12, borderRadius: 3, backgroundColor: '#6B7280' },
  detailText: { flex: 1, color: '#333', fontSize: 13 },
  highlightBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  highlightText: { fontSize: 11, color: '#92400E', fontWeight: '700', flex: 1 },
  tripHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  tripTitle: { color: '#111', fontSize: 18, fontWeight: '800', textAlign: 'left' },
  seeMore: { marginTop: 10, color: '#2563EB', fontWeight: '700', fontSize: 13, textAlign: 'center', alignSelf: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(17, 24, 39, 0.35)' },
  filterModal: { width: '100%', maxWidth: 360, backgroundColor: '#FFF', borderRadius: 24, padding: 18, gap: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  filterModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterModalTitle: { color: '#111', fontSize: 18, fontWeight: '800' },
  filterSectionLabel: { color: '#111', fontSize: 13, fontWeight: '700' },
  filterChoicesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChoiceButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB' },
  filterChoiceButtonActive: { backgroundColor: '#111', borderColor: '#111' },
  filterChoiceText: { color: '#111', fontSize: 13, fontWeight: '600' },
  filterChoiceTextActive: { color: '#FFF' },
  modalInput: { height: 44, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, color: '#111', backgroundColor: '#F9FAFB', fontSize: 14 },
  filterFooter: { flexDirection: 'row', gap: 10, marginTop: 4 },
  filterResetButton: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  filterResetText: { color: '#111', fontSize: 14, fontWeight: '700' },
  filterDoneButton: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  filterDoneText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
