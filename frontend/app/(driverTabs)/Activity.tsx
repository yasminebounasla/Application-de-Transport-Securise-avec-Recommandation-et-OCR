import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Animated, Alert,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRide } from '../../context/RideContext';

const CATEGORIES = [
  { key: 'completed', label: 'Completed' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'cancelled', label: 'Cancelled' },
];
const PRICE_FILTERS = [
  { key: 'none', label: 'Price: none' },
  { key: 'asc', label: 'Price: low to high' },
  { key: 'desc', label: 'Price: high to low' },
];
const NAME_FILTERS = [
  { key: 'none', label: 'Name: none' },
  { key: 'az', label: 'Name: A-Z' },
  { key: 'za', label: 'Name: Z-A' },
];
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
  }, [highlighted]);
  const bgColor = anim.interpolate({ inputRange: [0, 1], outputRange: ['#FFFFFF', '#FFF3CD'] });
  const borderColor = anim.interpolate({ inputRange: [0, 1], outputRange: ['#E5E7EB', '#F59E0B'] });
  return (
    <Animated.View style={[styles.rideCard, { backgroundColor: bgColor, borderColor }]}>
      {children}
    </Animated.View>
  );
}

export default function DriverActivityScreen() {
  const { user } = useAuth();
  const { acceptRide, rejectRide } = useRide();
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
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<{ rideId: number | null; action: 'accept' | 'reject' | null }>({
    rideId: null,
    action: null,
  });
  const flatListRef = useRef<FlatList>(null);

  // ✅ KEY FIX: on garde une ref separee pour le tab et rideId cible
  // comme ca meme si activity se re-charge, on peut re-appliquer le highlight
  const pendingHighlight = useRef<{ rideId: number; tab: string } | null>(null);

  const showFlash = (type: 'success' | 'error', text: string) => {
    setFlash({ type, text });
    setTimeout(() => setFlash(null), 2500);
  };

  const loadActivity = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      setError('');
      const response = await api.get(`/rides/activity/driver/${user.id}`);
      const data = response?.data?.data || [];
      setActivity(data);
    } catch (err: any) {
      setError("Impossible de charger l'activite.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadActivity();
    }, [loadActivity])
  );

  // ✅ Step 1: quand les params changent, on sauvegarde la cible dans la ref
  // et on switch le tab IMMEDIATEMENT
  useEffect(() => {
    if (!params.rideId) return;
    const rideId = parseInt(params.rideId as string);
    const tab = (params.tab as string) || 'pending';
    pendingHighlight.current = { rideId, tab };
    setActiveCategory(tab); // switch tab tout de suite
  }, [params.rideId, params.tab]);

  // ✅ Step 2: quand activity EST charge ET qu'on a un highlight en attente,
  // on applique le highlight + scroll
  useEffect(() => {
    if (activity.length === 0) return;
    if (!pendingHighlight.current) return;

    const { rideId, tab } = pendingHighlight.current;

    const ride = activity.find((r: any) => r.rideId === rideId);
    if (!ride) return;

    // consommer seulement si le ride est trouvé
    pendingHighlight.current = null;

    // S'assurer que le bon tab est actif
    setActiveCategory(tab);
    setHighlightedId(rideId);

    // Scroll apres que React ait re-rendu avec le bon tab
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
      rides = rides.filter((ride: any) => {
        const p = ride.passenger || {};
        return `${p.prenom || ''} ${p.nom || ''}`.toLowerCase().includes(q);
      });
    }
    rides = [...rides];
    if (nameFilter === 'az') rides.sort((a: any, b: any) => `${a.passenger?.prenom || ''}`.localeCompare(`${b.passenger?.prenom || ''}`));
    if (nameFilter === 'za') rides.sort((a: any, b: any) => `${b.passenger?.prenom || ''}`.localeCompare(`${a.passenger?.prenom || ''}`));
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
    if (status === 'CANCELLED_BY_DRIVER') return 'CANCELLED BY YOU';
    if (status === 'CANCELLED_BY_PASSENGER') return 'CANCELLED BY PASSENGER';
    return status;
  };

  const cycleFilter = (current: string, values: { key: string; label: string }[]) => {
    const idx = values.findIndex((v) => v.key === current);
    return values[idx === values.length - 1 ? 0 : idx + 1].key;
  };

  const handleRideAction = async (rideId: number, action: 'accept' | 'reject') => {
    try {
      setActionLoading({ rideId, action });
      if (action === 'accept') {
        await acceptRide(rideId);
        showFlash('success', 'Ride accepted!');
        pendingHighlight.current = { rideId, tab: 'accepted' };
        setActiveCategory('accepted');
      } else {
        await rejectRide(rideId);
        showFlash('error', 'Ride rejected!');
      }
      await loadActivity();
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.response?.data?.message || e?.message || `Failed to ${action} ride.`
      );
    } finally {
      setActionLoading({ rideId: null, action: null });
    }
  };

  const confirmRideAction = (rideId: number, action: 'accept' | 'reject') => {
    Alert.alert(
      action === 'accept' ? 'Accept ride?' : 'Reject ride?',
      action === 'accept'
        ? 'This pending ride will be assigned to you.'
        : 'This pending ride will be rejected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'accept' ? 'Accept' : 'Reject',
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: () => handleRideAction(rideId, action),
        },
      ]
    );
  };

  const renderRide = ({ item }: { item: any }) => {
    const dateLabel = item.dateDepart ? new Date(item.dateDepart).toLocaleDateString() : 'N/A';
    const timeLabel = item.heureDepart || 'N/A';
    const start = item.startAddress || item.depart || 'N/A';
    const end = item.endAddress || item.destination || 'N/A';
    const isHighlighted = item.rideId === highlightedId;
    const passenger = item.passenger || {};
    const passengerName = `${passenger.prenom || 'Unknown'} ${passenger.nom || 'Passenger'}`.trim();
    const passengerPhone = passenger.numTel ? String(passenger.numTel) : 'N/A';
    const isPendingRequest = item.status === 'PENDING';
    const isActionLoading = actionLoading.rideId === item.rideId;

    const cardContent = (
      <HighlightCard highlighted={isHighlighted}>
        <>
          <View style={styles.pendingHeader}>
            <View style={styles.pendingPassengerInfo}>
              <MaterialIcons name="account-circle" size={40} color="#111" />
              <View style={styles.pendingPassengerDetails}>
                <Text style={styles.pendingPassengerName}>{passengerName}</Text>
                <Text style={styles.pendingPassengerPhone}>{passengerPhone}</Text>
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
          {isPendingRequest ? (
            <View style={styles.pendingActions}>
              <TouchableOpacity
                style={[styles.pendingActionButton, styles.rejectButton, isActionLoading && styles.actionButtonDisabled]}
                onPress={() => confirmRideAction(item.rideId, 'reject')}
                disabled={isActionLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle" size={20} color="#000" />
                <Text style={styles.rejectButtonText}>
                  {isActionLoading && actionLoading.action === 'reject' ? 'Rejecting...' : 'Reject'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pendingActionButton, styles.acceptButton, isActionLoading && styles.actionButtonDisabled]}
                onPress={() => confirmRideAction(item.rideId, 'accept')}
                disabled={isActionLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.acceptButtonText}>
                  {isActionLoading && actionLoading.action === 'accept' ? 'Accepting...' : 'Accept'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.seeMore}>See more infos</Text>
          )}
        </>
      </HighlightCard>
    );

    if (isPendingRequest) return cardContent;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() =>
          router.push(`/shared/ride-details/${item.rideId}` as any)
        }
      >
        {cardContent}
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Chargement de votre activite...</Text>
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
        renderItem={renderRide}
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
            <View style={styles.filtersHeader}>
              <TouchableOpacity style={styles.filterToggleButton} onPress={() => setShowFilters((prev) => !prev)}>
                <MaterialIcons name="filter-list" size={18} color="#111" />
                <Text style={styles.filterToggleText}>Filtrage</Text>
              </TouchableOpacity>
            </View>
            {showFilters && (
              <View style={styles.filtersPanel}>
                <TextInput style={styles.input} value={nameQuery} onChangeText={setNameQuery} placeholder="Filtrer par nom passager..." placeholderTextColor="#999" />
                <View style={styles.filterButtonsRow}>
                  <TouchableOpacity style={styles.filterOptionButton} onPress={() => setPriceFilter((v) => cycleFilter(v, PRICE_FILTERS))}>
                    <Text style={styles.filterOptionText}>{PRICE_FILTERS.find(f => f.key === priceFilter)?.label}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.filterOptionButton} onPress={() => setNameFilter((v) => cycleFilter(v, NAME_FILTERS))}>
                    <Text style={styles.filterOptionText}>{NAME_FILTERS.find(f => f.key === nameFilter)?.label}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {!!flash && (
              <View style={[styles.flash, flash.type === 'success' ? styles.flashSuccess : styles.flashError]}>
                <Text style={[styles.flashText, flash.type === 'error' && styles.flashTextError]}>{flash.text}</Text>
              </View>
            )}
            {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Liste trajets</Text>
              <Text style={styles.sectionCount}>{visibleRides.length}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#666' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 28, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#666', marginBottom: 8 },
  emptySubText: { fontSize: 14, color: '#999' },
  flash: { marginTop: 10, marginBottom: 4, borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12 },
  flashSuccess: { backgroundColor: '#ECFDF3', borderColor: '#ABEFC6' },
  flashError: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  flashText: { fontSize: 13, fontWeight: '800', color: '#111' },
  flashTextError: { color: '#B42318' },
  errorBox: { marginTop: 4, marginBottom: 8, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#FFF1F1', borderWidth: 1, borderColor: '#FFCACA' },
  errorText: { color: '#B42318', fontSize: 13, fontWeight: '600' },
  categoriesRow: { flexDirection: 'row', marginTop: 8, gap: 8 },
  categoryButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB' },
  categoryButtonActive: { backgroundColor: '#111', borderColor: '#111' },
  categoryText: { color: '#111', fontSize: 13, fontWeight: '600' },
  categoryTextActive: { color: '#FFF' },
  filtersHeader: { marginTop: 10 },
  filterToggleButton: { alignSelf: 'flex-start', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterToggleText: { color: '#111', fontWeight: '600', fontSize: 13 },
  filtersPanel: { marginTop: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, gap: 10 },
  input: { height: 42, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, color: '#111', backgroundColor: '#FAFAFA', fontSize: 14 },
  filterButtonsRow: { flexDirection: 'row', gap: 8 },
  filterOptionButton: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 10, paddingHorizontal: 10 },
  filterOptionText: { color: '#111', fontWeight: '600', fontSize: 12, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  sectionCount: { minWidth: 30, height: 30, borderRadius: 15, backgroundColor: '#111', color: '#FFF', textAlign: 'center', textAlignVertical: 'center', fontWeight: '700', fontSize: 13, overflow: 'hidden', paddingTop: 6 },
  listContainer: { paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 },
  rideCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, marginBottom: 12 },
  pendingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 },
  pendingPassengerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  pendingPassengerDetails: { marginLeft: 10, flex: 1 },
  pendingPassengerName: { color: '#111', fontSize: 16, fontWeight: '700' },
  pendingPassengerPhone: { color: '#666', fontSize: 13, marginTop: 2 },
  pendingSeparator: { height: 1, backgroundColor: '#E5E7EB', marginBottom: 12 },
  pendingActions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  pendingActionButton: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  rideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rideId: { color: '#111', fontWeight: '700', fontSize: 14 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  completedBadge: { backgroundColor: '#D1FAE5' },
  pendingBadge: { backgroundColor: '#DBEAFE' },
  acceptedBadge: { backgroundColor: '#DCFCE7' },
  cancelledDriverBadge: { backgroundColor: '#FEE2E2' },
  cancelledPassengerBadge: { backgroundColor: '#FFEDD5' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#111' },
  acceptedText: { color: '#166534' },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  pendingStartDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#111' },
  pendingEndDot: { width: 12, height: 12, borderRadius: 3, backgroundColor: '#6B7280' },
  acceptButton: { backgroundColor: '#000' },
  acceptButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  rejectButton: { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#000' },
  rejectButtonText: { color: '#000', fontSize: 14, fontWeight: '600' },
  actionButtonDisabled: { opacity: 0.6 },
  detailText: { flex: 1, color: '#333', fontSize: 13 },
  highlightBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  highlightText: { fontSize: 11, color: '#92400E', fontWeight: '700', flex: 1 },
  tripHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  tripTitle: { color: '#111', fontSize: 18, fontWeight: '800', textAlign: 'left' },
  seeMore: { marginTop: 10, color: '#2563EB', fontWeight: '700', fontSize: 13, textAlign: 'center', alignSelf: 'center' },
});
