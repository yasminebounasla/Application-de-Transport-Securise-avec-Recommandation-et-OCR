import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useRide } from '../../context/RideContext';
import RideCard from '../../components/RideCard';

export default function RideRequestsScreen() {
  const router = useRouter();
  const { driverRequests, getDriverRequests, loading } = useRide();
  
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    console.log('🔵 RideRequestsScreen monté');
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      console.log('🔄 Chargement des demandes...');
      await getDriverRequests();
    } catch (error) {
      console.error('❌ Erreur chargement demandes:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const handleCardPress = (ride) => {
    console.log('📍 Opening map for ride:', ride.id);
    
    router.push({
      pathname: '/shared/MapScreen',
      params: {
        rideId: ride.id.toString(),
        startLat: ride.startLat.toString(),
        startLng: ride.startLng.toString(),
        endLat: ride.endLat.toString(),
        endLng: ride.endLng.toString(),
        startAddress: ride.startAddress,
        endAddress: ride.endAddress,
        status: ride.status,
        selectionType: 'route',
      }
    });
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ride Requests</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{driverRequests.length}</Text>
        </View>
      </View>

      {driverRequests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No pending requests</Text>
          <Text style={styles.emptySubText}>Pull to refresh</Text>
        </View>
      ) : (
        <FlatList
          data={driverRequests}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <RideCard
              ride={item}
              onPress={() => handleCardPress(item)}
              showActions={false} onAccept={undefined} onReject={undefined}            />
          )}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#000']}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  badge: {
    backgroundColor: '#000',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
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
});