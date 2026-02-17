<<<<<<< HEAD
import { View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import Button from '../../components/Button';

export default function HomeScreen() {
  return (
    
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 bg-white p-5">

        <Button 
          title=" Ride Requests "
          onPress={() => router.push('/driver/RideRequestsScreen')}
          variant="primary"
          style={{ marginBottom: 12 }}
        />
        <Button 
            title="ProfileSetup"
            onPress={() => router.push('/driver/ProfileSetupScreen')}
            variant="secondary"
            style={{ marginBottom: 12 }}
          />

          <Button 
            title="Profile"
            onPress={() => router.push('/shared/ProfileScreen')}
            variant="secondary"
            style={{ marginBottom: 12 }}
          />
          
          <Button 
          title=" My Feedbacks "
          onPress={() => router.push('/driver/MyFeedbacksScreen')}
          variant="primary"
          style={{ marginBottom: 12 }}
        />
      
      </View>
    </ScrollView>
  );
}
=======
import { View, ScrollView, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useRide } from '../../context/RideContext';

export default function HomeScreen() {
  const { getDriverRequests, driverRequests, loading } = useRide();

  useEffect(() => {
    getDriverRequests();
  }, []);

  const pendingCount = useMemo(() => {
    return (driverRequests || []).filter((ride: any) => ride.status === 'PENDING').length;
  }, [driverRequests]);

  const activeRide = useMemo(() => {
    return (driverRequests || []).find(
      (ride: any) => ride.status === 'ACCEPTED' || ride.status === 'IN_PROGRESS',
    );
  }, [driverRequests]);

  const stats = useMemo(() => {
    const total = (driverRequests || []).length;
    const accepted = (driverRequests || []).filter((ride: any) => ride.status === 'ACCEPTED').length;
    const completed = (driverRequests || []).filter((ride: any) => ride.status === 'COMPLETED').length;
    return { total, accepted, completed };
  }, [driverRequests]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.pendingCard} onPress={() => router.push('/driver/RideRequestsScreen' as any)}>
        <View>
          <Text style={styles.pendingLabel}>Demandes en attente</Text>
          <Text style={styles.pendingHint}>Voir toutes les demandes</Text>
        </View>
        <View style={styles.badge}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.badgeText}>{pendingCount}</Text>}
        </View>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trajet en cours</Text>
        {loading ? (
          <ActivityIndicator color="#111" />
        ) : activeRide ? (
          <TouchableOpacity style={styles.card} onPress={() => router.push('/driver/ActiveRideScreen' as any)}>
            <Text style={styles.cardTitle}>
              {activeRide.startAddress || 'Depart'} -> {activeRide.endAddress || 'Destination'}
            </Text>
            <Text style={styles.cardSubtitle}>Statut: {activeRide.status}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.emptyText}>Aucun trajet actif.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stats</Text>
        <View style={styles.statsRow}>
          <StatBox icon="list-alt" label="Total" value={stats.total} />
          <StatBox icon="check-circle" label="Acceptes" value={stats.accepted} />
          <StatBox icon="flag" label="Termines" value={stats.completed} />
        </View>
      </View>
    </ScrollView>
  );
}

function StatBox({ icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <MaterialIcons name={icon} size={20} color="#111" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f8',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  pendingCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ececec',
    marginBottom: 18,
  },
  pendingLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  pendingHint: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  badge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ececec',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});
>>>>>>> b53e904 (Driver & Passenger HomeScreens + Navigation tabs (not fully complete))
