import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRide } from '../../../context/RideContext';

export default function PassengerHomeScreen({ navigation }) {
  const { getPassengerRides, passengerRides, loading } = useRide();

  useEffect(() => {
    getPassengerRides();
  }, []);

  const activeTrips = useMemo(() => {
    return (passengerRides || []).filter(
      (ride) => ride.status === 'ACCEPTED' || ride.status === 'IN_PROGRESS',
    );
  }, [passengerRides]);

  const quickActions = [
    {
      label: 'Demander un trajet',
      icon: 'add-road',
      onPress: () => navigation?.navigate('Search'),
    },
    {
      label: 'Chauffeurs recommandes',
      icon: 'groups',
      onPress: () => navigation?.navigate('Recommended'),
    },
    {
      label: 'Historique',
      icon: 'history',
      onPress: () => navigation?.navigate('History'),
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.searchButton} onPress={() => navigation?.navigate('Search')}>
        <MaterialIcons name="search" size={22} color="#fff" />
        <Text style={styles.searchButtonText}>Rechercher un trajet</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trajets en cours</Text>
        {loading ? (
          <ActivityIndicator color="#111" />
        ) : activeTrips.length === 0 ? (
          <Text style={styles.emptyText}>Aucun trajet en cours.</Text>
        ) : (
          activeTrips.slice(0, 3).map((trip) => (
            <View key={trip.id} style={styles.card}>
              <Text style={styles.cardTitle}>{trip.startAddress || 'Depart'} -> {trip.endAddress || 'Destination'}</Text>
              <Text style={styles.cardSubtitle}>Statut: {trip.status}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Navigation rapide</Text>
        <View style={styles.grid}>
          {quickActions.map((action) => (
            <TouchableOpacity key={action.label} style={styles.quickCard} onPress={action.onPress}>
              <MaterialIcons name={action.icon} size={24} color="#111" />
              <Text style={styles.quickText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
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
  searchButton: {
    backgroundColor: '#111',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
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
  emptyText: {
    color: '#666',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  cardSubtitle: {
    marginTop: 4,
    color: '#666',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  quickCard: {
    width: '31%',
    minWidth: 92,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ececec',
  },
  quickText: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
    color: '#111',
    fontWeight: '600',
  },
});
