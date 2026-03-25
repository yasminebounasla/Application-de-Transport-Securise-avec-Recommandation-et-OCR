import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity, Animated,
  Pressable, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';


// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'completed', label: 'Completed' },
<<<<<<< HEAD
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
=======
  { key: 'active',    label: 'Active'    },
  { key: 'pending',   label: 'Pending'   },
>>>>>>> 46ff32f16fb87b43f9091e209998127c51f2ff47
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  COMPLETED:              { label: 'Completed',           bg: '#D1FAE5', color: '#065F46', icon: 'checkmark-circle' },
  PENDING:                { label: 'Pending',             bg: '#DBEAFE', color: '#1E40AF', icon: 'time'             },
  ACCEPTED:               { label: 'Accepted',            bg: '#DCFCE7', color: '#166534', icon: 'checkmark'        },
  IN_PROGRESS:            { label: 'In progress',         bg: '#FEF9C3', color: '#854D0E', icon: 'car-outline'      },
  CANCELLED_BY_PASSENGER: { label: 'Cancelled by you',    bg: '#FEE2E2', color: '#991B1B', icon: 'close-circle'     },
  CANCELLED_BY_DRIVER:    { label: 'Cancelled by driver', bg: '#FFEDD5', color: '#9A3412', icon: 'close-circle'     },
};

type SortKey = 'date_desc' | 'date_asc' | 'price_desc' | 'price_asc' | 'name_az' | 'name_za' | 'none';

const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'date_desc',  label: 'Date: newest first', icon: 'calendar'         },
  { key: 'date_asc',   label: 'Date: oldest first', icon: 'calendar-outline' },
  { key: 'price_desc', label: 'Price: high to low', icon: 'trending-down'    },
  { key: 'price_asc',  label: 'Price: low to high', icon: 'trending-up'      },
  { key: 'name_az',    label: 'Driver: A → Z',      icon: 'text'             },
  { key: 'name_za',    label: 'Driver: Z → A',      icon: 'text'             },
];

// ─── AVATAR ───────────────────────────────────────────────────────────────────
function getAvatarColor(sexe?: string) {
  const val = (sexe ?? '').toLowerCase().trim();
  if (val === 'f' || val === 'female' || val === 'femme' || val === 'woman')
    return { bg: '#fad0e2', text: '#BE185D' };
  return { bg: '#d3e4fa', text: '#1B72DA' };
}

function Avatar({ prenom, nom, sexe }: { prenom?: string; nom?: string; sexe?: string }) {
  const initials = `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase() || '?';
  const colors   = getAvatarColor(sexe);
  return (
    <View style={[s.avatar, { backgroundColor: colors.bg }]}>
      <Text style={[s.avatarText, { color: colors.text }]}>{initials}</Text>
    </View>
  );
}

// ─── TAG ──────────────────────────────────────────────────────────────────────
function Tag({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={s.tag}>
      <Ionicons name={icon as any} size={10} color="#9CA3AF" />
      <Text style={s.tagText}>{label}</Text>
    </View>
  );
}

// ─── RIDE CARD ────────────────────────────────────────────────────────────────
function RideCard({ item, highlighted, onPress }: {
  item: any; highlighted: boolean; onPress: () => void;
}) {
  const scale    = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const onPressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  useEffect(() => {
    if (!highlighted) { glowAnim.setValue(0); return; }
    Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.delay(1200),
      Animated.timing(glowAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
    ]).start();
  }, [highlighted]);

  // ✅ highlight gris/noir au lieu de jaune
  const borderColor = glowAnim.interpolate({ inputRange: [0, 1], outputRange: ['#F3F4F6', '#111111'] });
  const bgColor     = glowAnim.interpolate({ inputRange: [0, 1], outputRange: ['#FFFFFF', '#F3F4F6'] });

  const driver    = item.driver || {};
  const cfg       = STATUS_CONFIG[item.status] || { label: item.status, bg: '#F3F4F6', color: '#6B7280', icon: 'ellipse-outline' };
  const isPending = item.status === 'PENDING';
  const hasDriver = !!(driver.prenom || driver.nom);

  const dateLabel = item.dateDepart
    ? new Date(item.dateDepart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';
  const start = item.startAddress || item.depart      || 'N/A';
  const end   = item.endAddress   || item.destination || 'N/A';
  const trunc = (str: string, n = 32) => str.length > n ? str.slice(0, n) + '…' : str;


  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[s.card, { borderColor, backgroundColor: bgColor, transform: [{ scale }] }]}>

        {/* ── HEADER ── */}
        <View style={s.cardHeader}>
          {isPending || !hasDriver ? (
            <View style={s.headerLeft}>
              <View style={s.awaitingAvatar}>
                <Ionicons name="search-outline" size={16} color="#9CA3AF" />
              </View>
              <View>
                <Text style={s.awaitingTitle}>Awaiting driver</Text>
                <Text style={s.awaitingSub}>Request sent · pending assignment</Text>
              </View>
            </View>
          ) : (
            <View style={s.headerLeft}>
              <Avatar prenom={driver.prenom} nom={driver.nom} sexe={driver.sexe} />
              <View>
                <Text style={s.driverName} numberOfLines={1}>{driver.prenom} {driver.nom}</Text>
                <Text style={s.driverSub}>{driver.numTel}</Text>
              </View>
            </View>
          )}
          <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
            <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* ── PRICE ── */}
        {item.prix != null && (
          <View style={s.priceRow}>
            <View style={s.priceBadge}>
              <Ionicons name="cash-outline" size={12} color="#065F46" />
              <Text style={s.priceText}>{Number(item.prix).toLocaleString('fr-FR')} DA</Text>
            </View>
          </View>
        )}

        {/* ── ROUTE ── */}
        <View style={s.routeBox}>
          <View style={s.routeRow}>
            <View style={[s.routeDot, { backgroundColor: '#22C55E' }]} />
            <Text style={s.routeText} numberOfLines={1}>{trunc(start)}</Text>
          </View>
          <View style={s.routeLine} />
          <View style={s.routeRow}>
            <View style={[s.routeDot, { backgroundColor: '#EF4444' }]} />
            <Text style={s.routeText} numberOfLines={1}>{trunc(end)}</Text>
          </View>
        </View>

        {/* ── TAGS ── */}
        <View style={s.tagsRow}>
          <Tag icon="calendar-outline" label={dateLabel} />
          {item.heureDepart && <Tag icon="time-outline" label={item.heureDepart} />}
          {item.placesDispo != null && (
            <Tag icon="people-outline" label={`${item.placesDispo} seat${item.placesDispo > 1 ? 's' : ''}`} />
          )}
        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer}>
          <Text style={s.seeMore}>See details →</Text>
        </View>

      </Animated.View>
    </Pressable>
  );
}

// ─── FILTER MODAL ─────────────────────────────────────────────────────────────
function FilterModal({ visible, current, nameQuery, onSelect, onNameChange, onReset, onClose }: {
  visible: boolean;
  current: SortKey;
  nameQuery: string;
  onSelect: (k: SortKey) => void;
  onNameChange: (v: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={s.modalBox} onPress={() => {}}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Filter & Sort</Text>

          {/* ── Search field ── */}
          <Text style={s.modalSectionLabel}>Search driver</Text>
          <View style={s.modalSearchBox}>
            <Ionicons name="search-outline" size={15} color="#9CA3AF" />
            <TextInput
              style={s.modalSearchInput}
              value={nameQuery}
              onChangeText={onNameChange}
              placeholder="Driver name..."
              placeholderTextColor="#BBB"
            />
            {nameQuery.length > 0 && (
              <TouchableOpacity onPress={() => onNameChange('')}>
                <Ionicons name="close-circle" size={16} color="#CCC" />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Sort options ── */}
          <Text style={[s.modalSectionLabel, { marginTop: 16 }]}>Sort by</Text>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[s.modalRow, current === opt.key && s.modalRowActive]}
              onPress={() => { onSelect(opt.key); }}
            >
              <Ionicons name={opt.icon as any} size={16} color={current === opt.key ? '#111' : '#9CA3AF'} />
              <Text style={[s.modalRowText, current === opt.key && s.modalRowTextActive]}>{opt.label}</Text>
              {current === opt.key && <Ionicons name="checkmark" size={16} color="#111" />}
            </TouchableOpacity>
          ))}

          {/* ── Footer buttons ── */}
          <View style={s.modalFooter}>
            <TouchableOpacity style={s.modalResetBtn} onPress={onReset}>
              <Text style={s.modalResetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalDoneBtn} onPress={onClose}>
              <Text style={s.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── SCREEN ───────────────────────────────────────────────────────────────────
export default function ActivityScreen() {
  const { user } = useAuth();
  const params   = useLocalSearchParams<{ rideId?: string; tab?: string }>();
  const router   = useRouter();

  const [activity,       setActivity]       = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [error,          setError]          = useState('');
  const [activeCategory, setActiveCategory] = useState('completed');
  const [sortKey,        setSortKey]        = useState<SortKey>('date_desc');
  const [nameQuery,      setNameQuery]      = useState('');
  const [showFilter,     setShowFilter]     = useState(false);
  const [highlightedId,  setHighlightedId]  = useState<number | null>(null);
  const flatListRef      = useRef<FlatList>(null);
  const pendingHighlight = useRef<{ rideId: number; tab: string } | null>(null);

  const loadActivity = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      setError('');
      const response = await api.get(`/rides/activity/passenger/${user.id}`);
      setActivity(response?.data?.data || []);
    } catch {
      setError("Unable to load your trips.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadActivity(); }, [loadActivity]));

  useEffect(() => {
    if (!params.rideId) return;
    const rideId = parseInt(params.rideId as string);
    // ✅ "active" pour les accepted/in_progress, "pending" pour les pending
    const tab = (params.tab as string) || 'completed';
    pendingHighlight.current = { rideId, tab };
    setActiveCategory(tab);
  }, [params.rideId, params.tab]);

  useEffect(() => {
    if (activity.length === 0 || !pendingHighlight.current) return;
    const { rideId, tab } = pendingHighlight.current;
    const ride = activity.find((r: any) => r.rideId === rideId);
    if (!ride) return;
    pendingHighlight.current = null;
    setActiveCategory(tab);
    setHighlightedId(rideId);

    // ✅ scroll amélioré — attend que le tab soit rendu
    setTimeout(() => {
      const tabRides = activity.filter((r: any) => {
        if (tab === 'completed') return r.status === 'COMPLETED';
<<<<<<< HEAD
        if (tab === 'pending') return r.status === 'PENDING';
        if (tab === 'accepted') return ['ACCEPTED', 'IN_PROGRESS'].includes(r.status);
=======
        if (tab === 'pending')   return r.status ==='PENDING';
        if (tab === 'active') return ['ACCEPTED', 'IN_PROGRESS'].includes(r.status);
>>>>>>> 46ff32f16fb87b43f9091e209998127c51f2ff47
        return ['CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER'].includes(r.status);
      });
      const index = tabRides.findIndex((r: any) => r.rideId === rideId);
      if (index >= 0) {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.3,
        });
      }
    }, 600);

    setTimeout(() => setHighlightedId(null), 5000);
  }, [activity]);

  const categorized = useMemo(() => ({
    completed: activity.filter((r: any) => r.status === 'COMPLETED'),
<<<<<<< HEAD
    pending: activity.filter((r: any) => r.status === 'PENDING'),
    accepted: activity.filter((r: any) => ['ACCEPTED', 'IN_PROGRESS'].includes(r.status)),
=======
    active:    activity.filter((r: any) => ['ACCEPTED', 'IN_PROGRESS'].includes(r.status)),
    pending:   activity.filter((r: any) => r.status === 'PENDING'),
>>>>>>> 46ff32f16fb87b43f9091e209998127c51f2ff47
    cancelled: activity.filter((r: any) => ['CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER'].includes(r.status)),
  }), [activity]);

  const visibleRides = useMemo(() => {
    let rides: any[] = (categorized as any)[activeCategory] || [];

    // Search filter
    if (nameQuery.trim()) {
      const q = nameQuery.trim().toLowerCase();
      rides = rides.filter((r: any) =>
        `${r.driver?.prenom || ''} ${r.driver?.nom || ''}`.toLowerCase().includes(q)
      );
    }

    rides = [...rides];
    if (sortKey === 'date_desc') rides.sort((a, b) => new Date(b.dateDepart || 0).getTime() - new Date(a.dateDepart || 0).getTime());
    if (sortKey === 'date_asc')  rides.sort((a, b) => new Date(a.dateDepart || 0).getTime() - new Date(b.dateDepart || 0).getTime());
    if (sortKey === 'price_desc')rides.sort((a, b) => (Number(b.prix) || 0) - (Number(a.prix) || 0));
    if (sortKey === 'price_asc') rides.sort((a, b) => (Number(a.prix) || 0) - (Number(b.prix) || 0));
    if (sortKey === 'name_az')   rides.sort((a, b) => (a.driver?.prenom || '').localeCompare(b.driver?.prenom || ''));
    if (sortKey === 'name_za')   rides.sort((a, b) => (b.driver?.prenom || '').localeCompare(a.driver?.prenom || ''));
    return rides;
  }, [activeCategory, categorized, sortKey, nameQuery]);

  const activeSortLabel = SORT_OPTIONS.find(o => o.key === sortKey)?.label;
  const hasActiveFilter = sortKey !== 'none' || nameQuery.trim().length > 0;

  const handleReset = () => {
    setSortKey('none');
    setNameQuery('');
  };

  if (loading && !refreshing) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={s.loadingText}>Loading your trips...</Text>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <FilterModal
        visible={showFilter}
        current={sortKey}
        nameQuery={nameQuery}
        onSelect={setSortKey}
        onNameChange={setNameQuery}
        onReset={handleReset}
        onClose={() => setShowFilter(false)}
      />

      <FlatList
        ref={flatListRef}
        onScrollToIndexFailed={() => {}}
        data={visibleRides}
        keyExtractor={(item: any) => String(item.rideId)}
        renderItem={({ item }) => (
          <RideCard
            item={item}
            highlighted={item.rideId === highlightedId}
            onPress={() => router.push(`/shared/ride-details/${item.rideId}` as any)}
          />
        )}
        ListHeaderComponent={
          <>
            {/* ── TABS + sort button ── */}
            <View style={s.tabsRow}>
              <View style={s.tabs}>
                {CATEGORIES.map((cat) => {
                  const count  = (categorized as any)[cat.key]?.length ?? 0;
                  const active = activeCategory === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[s.tab, active && s.tabActive]}
                      onPress={() => setActiveCategory(cat.key)}
                    >
                      <Text style={[s.tabText, active && s.tabTextActive]}>{cat.label}</Text>
                      {count > 0 && (
                        <View style={[s.tabBadge, active && s.tabBadgeActive]}>
                          <Text style={[s.tabBadgeText, active && s.tabBadgeTextActive]}>{count}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Sort/filter button */}
              <TouchableOpacity
                style={[s.sortBtn, hasActiveFilter && s.sortBtnActive]}
                onPress={() => setShowFilter(true)}
              >
                <Ionicons name="funnel-outline" size={15} color={hasActiveFilter ? '#fff' : '#111'} />
              </TouchableOpacity>
            </View>

            {/* Active filter indicator */}
            {hasActiveFilter && (
              <View style={s.activeFilterRow}>
                {nameQuery.trim().length > 0 && (
                  <View style={s.filterPill}>
                    <Ionicons name="search-outline" size={11} color="#374151" />
                    <Text style={s.filterPillText}>"{nameQuery}"</Text>
                    <TouchableOpacity onPress={() => setNameQuery('')}>
                      <Ionicons name="close" size={12} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                )}
                {sortKey !== 'none' && (
                  <View style={s.filterPill}>
                    <Ionicons name="swap-vertical-outline" size={11} color="#374151" />
                    <Text style={s.filterPillText}>{activeSortLabel}</Text>
                    <TouchableOpacity onPress={() => setSortKey('none')}>
                      <Ionicons name="close" size={12} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {!!error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={14} color="#B42318" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <Text style={s.countText}>
              {visibleRides.length} trip{visibleRides.length !== 1 ? 's' : ''}
            </Text>
          </>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="car-outline" size={48} color="#D1D5DB" />
            <Text style={s.emptyTitle}>No trips yet</Text>
            <Text style={s.emptySub}>Pull down to refresh</Text>
          </View>
        }
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadActivity(); setRefreshing(false); }}
            colors={['#000']}
          />
        }
      />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#F5F5F5' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 15 },
  list:        { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8, flexGrow: 1 },

  // Tabs
  tabsRow:            { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  tabs:               { flex: 1, flexDirection: 'row', gap: 6 },
  tab:                { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#F3F4F6' },
  tabActive:          { backgroundColor: '#111', borderColor: '#111' },
  tabText:            { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  tabTextActive:      { color: '#fff' },
  tabBadge:           { minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tabBadgeActive:     { backgroundColor: 'rgba(255,255,255,0.2)' },
  tabBadgeText:       { fontSize: 9, fontWeight: '800', color: '#6B7280' },
  tabBadgeTextActive: { color: '#fff' },
  sortBtn:            { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  sortBtnActive:      { backgroundColor: '#111', borderColor: '#111' },

  // Active filter pills
  activeFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  filterPill:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0F0F0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  filterPillText:  { fontSize: 11, color: '#374151', fontWeight: '600' },

  countText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', marginBottom: 8 },

  errorBox:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF1F1', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#FFCACA' },
  errorText: { color: '#B42318', fontSize: 13, fontWeight: '600', flex: 1 },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#6B7280' },
  emptySub:   { fontSize: 13, color: '#9CA3AF' },

  // Card
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: '#F3F4F6', padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },

  cardHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headerLeft:    { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  avatar:        { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText:    { fontSize: 13, fontWeight: '800' },
  driverName:    { fontSize: 14, fontWeight: '700', color: '#111' },
  driverSub:     { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },

  awaitingAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  awaitingTitle:  { fontSize: 14, fontWeight: '700', color: '#374151' },
  awaitingSub:    { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  statusText:  { fontSize: 11, fontWeight: '700' },

  priceRow:   { marginBottom: 10 },
  priceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  priceText:  { fontSize: 13, fontWeight: '800', color: '#065F46' },

  routeBox:  { backgroundColor: '#FAFAFA', borderRadius: 10, padding: 10, marginBottom: 10, gap: 4 },
  routeRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeDot:  { width: 8, height: 8, borderRadius: 4 },
  routeLine: { width: 1.5, height: 10, backgroundColor: '#E5E7EB', marginLeft: 3.25 },
  routeText: { fontSize: 13, color: '#374151', fontWeight: '500', flex: 1 },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
  tag:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F5F5F5', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },

  footer:  { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8 },
  seeMore: { fontSize: 12, fontWeight: '700', color: '#2563EB', textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalBox:     { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 16 },

  modalSectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  modalSearchBox:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, height: 44 },
  modalSearchInput: { flex: 1, fontSize: 14, color: '#111' },

  modalRow:           { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalRowActive:     {},
  modalRowText:       { flex: 1, fontSize: 14, color: '#6B7280', fontWeight: '500' },
  modalRowTextActive: { color: '#111', fontWeight: '700' },

  modalFooter:    { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalResetBtn:  { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  modalResetText: { fontSize: 14, fontWeight: '700', color: '#111' },
  modalDoneBtn:   { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  modalDoneText:  { fontSize: 14, fontWeight: '700', color: '#fff' },
});