import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = [
  { key: 'completed', label: 'Completed' },
  { key: 'pending', label: 'Pending' },
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

export default function DriverActivityScreen() {
  const { user } = useAuth();
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('completed');
  const [showFilters, setShowFilters] = useState(false);
  const [priceFilter, setPriceFilter] = useState('none');
  const [nameFilter, setNameFilter] = useState('none');
  const [nameQuery, setNameQuery] = useState('');

  const loadActivity = useCallback(async () => {
    if (!user?.id) {
      setError('Conducteur introuvable.');
      setActivity([]);
      setLoading(false);
      return;
    }

    try {
      setError('');
      const response = await api.get(`/rides/activity/driver/${user.id}`);
      setActivity(response?.data?.data || []);
    } catch (err: any) {
      console.error('Erreur load driver activity:', err?.response?.data || err?.message);
      setError("Impossible de charger l'activite.");
      setActivity([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const categorized = useMemo(() => {
    const completed = activity.filter((ride: any) => ride.status === 'COMPLETED');
    const pending = activity.filter((ride: any) =>
      ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(ride.status)
    );
    const cancelled = activity.filter((ride: any) =>
      ['CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER'].includes(ride.status)
    );

    return { completed, pending, cancelled };
  }, [activity]);

  const stats = useMemo(() => {
    const total = activity.length;
    const completed = activity.filter((ride: any) => ride.status === 'COMPLETED').length;
    const pending = activity.filter((ride: any) =>
      ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(ride.status)
    ).length;
    const cancelled = activity.filter((ride: any) =>
      ['CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER'].includes(ride.status)
    ).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, pending, cancelled, completionRate };
  }, [activity]);

  const visibleRides = useMemo(() => {
    let rides: any[] = (categorized as any)[activeCategory] || [];

    if (nameQuery.trim()) {
      const q = nameQuery.trim().toLowerCase();
      rides = rides.filter((ride: any) => {
        const p = ride.passenger || {};
        const name = `${p.prenom || ''} ${p.nom || ''}`.toLowerCase();
        return name.includes(q);
      });
    }

    rides = [...rides];

    if (nameFilter === 'az') {
      rides.sort((a: any, b: any) => {
        const aName = `${a.passenger?.prenom || ''} ${a.passenger?.nom || ''}`.trim();
        const bName = `${b.passenger?.prenom || ''} ${b.passenger?.nom || ''}`.trim();
        return aName.localeCompare(bName);
      });
    } else if (nameFilter === 'za') {
      rides.sort((a: any, b: any) => {
        const aName = `${a.passenger?.prenom || ''} ${a.passenger?.nom || ''}`.trim();
        const bName = `${b.passenger?.prenom || ''} ${b.passenger?.nom || ''}`.trim();
        return bName.localeCompare(aName);
      });
    }

    if (priceFilter === 'asc') {
      rides.sort((a: any, b: any) => (Number(a.prix) || 0) - (Number(b.prix) || 0));
    } else if (priceFilter === 'desc') {
      rides.sort((a: any, b: any) => (Number(b.prix) || 0) - (Number(a.prix) || 0));
    }

    return rides;
  }, [activeCategory, categorized, nameFilter, priceFilter, nameQuery]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActivity();
    setRefreshing(false);
  };

  const getStatusBadgeStyle = (status: string) => {
    if (status === 'COMPLETED') return styles.completedBadge;
    if (status === 'CANCELLED_BY_DRIVER') return styles.cancelledDriverBadge;
    if (status === 'CANCELLED_BY_PASSENGER') return styles.cancelledPassengerBadge;
    if (status === 'ACCEPTED') return styles.acceptedBadge;
    if (status === 'PENDING') return styles.pendingBadge;
    return styles.pendingBadge;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'CANCELLED_BY_DRIVER') return 'Cancelled by driver';
    if (status === 'CANCELLED_BY_PASSENGER') return 'Cancelled by passenger';
    return status;
  };

  const renderRide = ({ item }: { item: any }) => {
    const passenger = item.passenger || {};
    const driver = item.driver || {};
    const passengerName = `${passenger.prenom || ''} ${passenger.nom || ''}`.trim() || 'N/A';
    const driverName =
      `${driver.prenom || user?.firstName || ''} ${driver.nom || user?.familyName || ''}`.trim() || 'N/A';
    const dateLabel = item.dateDepart ? new Date(item.dateDepart).toLocaleDateString() : 'N/A';
    const timeLabel = item.heureDepart || 'N/A';
    const start = item.startAddress || item.depart || 'N/A';
    const end = item.endAddress || item.destination || 'N/A';
    const price = Number(item.prix) || 0;

    return (
      <View style={styles.rideCard}>
        <View style={styles.rideHeader}>
          <Text style={styles.rideId}>Trip #{item.rideId}</Text>
          <View style={[styles.statusBadge, getStatusBadgeStyle(item.status)]}>
            <Text
              style={[
                styles.statusText,
                item.status === 'ACCEPTED' && styles.acceptedText,
              ]}
            >
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <MaterialIcons name="event" size={18} color="#444" />
          <Text style={styles.detailText}>Date: {dateLabel}</Text>
        </View>
        <View style={styles.detailRow}>
          <MaterialIcons name="schedule" size={18} color="#444" />
          <Text style={styles.detailText}>Heure: {timeLabel}</Text>
        </View>
        <View style={styles.detailRow}>
          <MaterialIcons name="my-location" size={18} color="#444" />
          <Text style={styles.detailText}>Depart: {start}</Text>
        </View>
        <View style={styles.detailRow}>
          <MaterialIcons name="location-on" size={18} color="#444" />
          <Text style={styles.detailText}>Arrivee: {end}</Text>
        </View>
        <View style={styles.detailRow}>
          <MaterialIcons name="person" size={18} color="#444" />
          <Text style={styles.detailText}>Passenger: {passengerName}</Text>
        </View>
        <View style={styles.detailRow}>
          <MaterialIcons name="badge" size={18} color="#444" />
          <Text style={styles.detailText}>Driver: {driverName}</Text>
        </View>
        <View style={styles.detailRow}>
          <MaterialIcons name="payments" size={18} color="#444" />
          <Text style={styles.detailText}>Prix: {price.toFixed(2)} DA</Text>
        </View>
      </View>
    );
  };

  const cycleFilter = (current: string, values: { key: string; label: string }[]) => {
    const idx = values.findIndex((v) => v.key === current);
    const nextIdx = idx === values.length - 1 ? 0 : idx + 1;
    return values[nextIdx].key;
  };

  const currentPriceLabel = PRICE_FILTERS.find((f) => f.key === priceFilter)?.label || 'Price';
  const currentNameLabel = NAME_FILTERS.find((f) => f.key === nameFilter)?.label || 'Name';

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
        data={visibleRides}
        keyExtractor={(item: any) => String(item.rideId)}
        renderItem={renderRide}
        ListHeaderComponent={
          <>
            <View style={styles.statsGrid}>
              <StatCard icon="list-alt" label="Total" value={stats.total} />
              <StatCard icon="flag" label="Termines" value={stats.completed} />
              <StatCard icon="hourglass-empty" label="Pending" value={stats.pending} />
              <StatCard icon="cancel" label="Cancelled" value={stats.cancelled} />
              <StatCard icon="percent" label="Taux succes" value={`${stats.completionRate}%`} />
            </View>

            <View style={styles.categoriesRow}>
              {CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.key}
                  style={[
                    styles.categoryButton,
                    activeCategory === category.key && styles.categoryButtonActive,
                  ]}
                  onPress={() => setActiveCategory(category.key)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      activeCategory === category.key && styles.categoryTextActive,
                    ]}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.filtersHeader}>
              <TouchableOpacity
                style={styles.filterToggleButton}
                onPress={() => setShowFilters((prev) => !prev)}
              >
                <MaterialIcons name="filter-list" size={18} color="#111" />
                <Text style={styles.filterToggleText}>Filtrage</Text>
              </TouchableOpacity>
            </View>

            {showFilters && (
              <View style={styles.filtersPanel}>
                <TextInput
                  style={styles.input}
                  value={nameQuery}
                  onChangeText={setNameQuery}
                  placeholder="Filtrer par nom passager..."
                  placeholderTextColor="#999"
                />
                <View style={styles.filterButtonsRow}>
                  <TouchableOpacity
                    style={styles.filterOptionButton}
                    onPress={() => setPriceFilter((v) => cycleFilter(v, PRICE_FILTERS))}
                  >
                    <Text style={styles.filterOptionText}>{currentPriceLabel}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.filterOptionButton}
                    onPress={() => setNameFilter((v) => cycleFilter(v, NAME_FILTERS))}
                  >
                    <Text style={styles.filterOptionText}>{currentNameLabel}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#000']}
          />
        }
      />
    </View>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <MaterialIcons name={icon as any} size={20} color="#111" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 16,
    paddingBottom: 6,
  },
  statCard: {
    width: '31%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  sectionCount: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#111',
    color: '#FFF',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '700',
    fontSize: 13,
    overflow: 'hidden',
    paddingTop: 6,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  categoriesRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  categoryButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryButtonActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  categoryText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#FFF',
  },
  filtersHeader: {
    marginTop: 10,
  },
  filterToggleButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterToggleText: {
    color: '#111',
    fontWeight: '600',
    fontSize: 13,
  },
  filtersPanel: {
    marginTop: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#111',
    backgroundColor: '#FAFAFA',
    fontSize: 14,
  },
  filterButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterOptionButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  filterOptionText: {
    color: '#111',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
  rideCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  rideId: {
    color: '#111',
    fontWeight: '700',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  completedBadge: {
    backgroundColor: '#D1FAE5',
  },
  pendingBadge: {
    backgroundColor: '#DBEAFE',
  },
  acceptedBadge: {
    backgroundColor: '#DCFCE7',
  },
  cancelledDriverBadge: {
    backgroundColor: '#FEE2E2',
  },
  cancelledPassengerBadge: {
    backgroundColor: '#FFEDD5',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111',
  },
  acceptedText: {
    color: '#166534',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  detailText: {
    flex: 1,
    color: '#333',
    fontSize: 13,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
  },
  errorBox: {
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF1F1',
    borderWidth: 1,
    borderColor: '#FFCACA',
  },
  errorText: {
    color: '#B42318',
    fontSize: 13,
    fontWeight: '600',
  },
});