import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRide } from '../../context/RideContext';
import RideCard from '../../components/RideCard';

export default function RideRequestsScreen() {
  const { driverRequests, getDriverRequests, acceptRide, rejectRide, loading } = useRide();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
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

  // ✅ Accept avec confirmation
  const handleAccept = (rideId) => {
    Alert.alert(
      'Accept Ride',
      'Are you sure you want to accept this ride?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          style: 'default',
          onPress: async () => {
            try {
              await acceptRide(rideId);
              Alert.alert('✅ Success', 'Ride accepted!');
              loadRequests();
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to accept ride');
            }
          },
        },
      ]
    );
  };

  // ✅ Reject avec confirmation
  const handleReject = (rideId) => {
    Alert.alert(
      'Reject Ride',
      'Are you sure you want to reject this ride?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectRide(rideId);
              loadRequests();
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to reject ride');
            }
          },
        },
      ]
    );
  };
  const { completeRide } = useRide();

  const handleComplete = async (rideId) => {
    try {
      await completeRide(rideId);
      Alert.alert('🏁 Success', 'Ride completed!');
      loadRequests();
    } catch (error) {
      Alert.alert('Error', 'Failed to complete ride');
    }
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
          <Text style={styles.emptyIcon}>🚗</Text>
          <Text style={styles.emptyText}>No pending requests</Text>
          <Text style={styles.emptySubText}>Pull down to refresh</Text>
        </View>
      ) : (
        <FlatList
          data={driverRequests}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <RideCard
              ride={item}
              showActions={true}      
              onAccept={handleAccept} 
              onReject={handleReject} 
              onPress={null}   
              onComplete={handleComplete}      
            />
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
    padding: 16,
    paddingBottom: 40,
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
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
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