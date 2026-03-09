import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useRide } from '../../context/RideContext';

const formatDateTime = (dateValue?: string) => {
  if (!dateValue) return 'Date non definie';
  const d = new Date(dateValue);
  return d.toLocaleString();
};

export default function MesTrajets() {
  const { driverRequests, currentRide, getDriverRequests, getDriverActiveRide, loading } = useRide();
  const [screenLoading, setScreenLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          await Promise.all([getDriverRequests(), getDriverActiveRide()]);
        } finally {
          if (active) setScreenLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const rides = useMemo(() => {
    const map = new Map();
    (driverRequests || []).forEach((ride: any) => {
      if (ride.status === 'ACCEPTED') {
        map.set(ride.id, ride);
      }
    });
    if (currentRide && currentRide.status === 'ACCEPTED') {
      map.set(currentRide.id, currentRide);
    }
    return Array.from(map.values()).sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [driverRequests, currentRide]);

  const openRide = (ride: any) => {
    router.push({
      pathname: '/driver/ActiveRideScreen',
      params: { trajetId: String(ride.id) },
    });
  };

  if ((screenLoading || loading) && rides.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
        <Text style={styles.subtle}>Chargement des trajets...</Text>
      </View>
    );
  }

  if (rides.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Aucun trajet actif</Text>
        <Text style={styles.subtle}>Vos demandes et trajets en cours apparaitront ici.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rides}
        keyExtractor={(item: any) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }: any) => (
          <TouchableOpacity style={styles.card} onPress={() => openRide(item)} activeOpacity={0.85}>
            <Text style={styles.route} numberOfLines={1}>
              {item.startAddress || item.depart || 'Depart'} -&gt; {item.endAddress || item.destination || 'Destination'}
            </Text>
            <Text style={styles.meta}>Depart: {formatDateTime(item.dateDepart)}</Text>
            <Text style={styles.meta}>Statut: {item.status}</Text>
            <Text style={styles.hint}>Appuyez pour ouvrir la carte du trajet.</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  list: { padding: 14, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  route: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 6 },
  meta: { fontSize: 13, color: '#444', marginBottom: 4 },
  hint: { marginTop: 4, fontSize: 12, color: '#2563EB', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 6 },
  subtle: { color: '#666', textAlign: 'center' },
});

