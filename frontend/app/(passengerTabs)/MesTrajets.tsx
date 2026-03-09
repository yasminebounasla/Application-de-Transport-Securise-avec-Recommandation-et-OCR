import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useRide } from '../../context/RideContext';

const TRACKING_WINDOW_MINUTES = 60;

const formatDateTime = (dateValue?: string) => {
  if (!dateValue) return 'Date non definie';
  const d = new Date(dateValue);
  return d.toLocaleString();
};

const minutesUntilDeparture = (dateValue?: string) => {
  if (!dateValue) return Number.POSITIVE_INFINITY;
  const departure = new Date(dateValue).getTime();
  return (departure - Date.now()) / 60000;
};

export default function MesTrajets() {
  const { passengerRides, getPassengerRides, loading } = useRide();

  useFocusEffect(
    useCallback(() => {
      getPassengerRides();
    }, [getPassengerRides])
  );

  const rides = useMemo(() => {
    return (passengerRides || []).filter((ride: any) =>
      ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(ride.status)
    );
  }, [passengerRides]);

  const openRide = (ride: any) => {
    const minsLeft = minutesUntilDeparture(ride.dateDepart);
    const shouldOpenMap =
      ride.status === 'ACCEPTED' ||
      ride.status === 'IN_PROGRESS' ||
      minsLeft <= TRACKING_WINDOW_MINUTES;

    if (shouldOpenMap) {
      router.push({
        pathname: '/passenger/RideTrackingScreen',
        params: { trajetId: String(ride.id) },
      });
      return;
    }

    router.push({
      pathname: '/passenger/HistoryScreen',
      params: { trajetId: String(ride.id) },
    });
  };

  if (loading && rides.length === 0) {
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
        <Text style={styles.subtle}>Vos trajets acceptes et en cours apparaitront ici.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rides}
        keyExtractor={(item: any) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }: any) => {
          const minsLeft = minutesUntilDeparture(item.dateDepart);
          const canTrack =
            item.status === 'ACCEPTED' ||
            item.status === 'IN_PROGRESS' ||
            minsLeft <= TRACKING_WINDOW_MINUTES;

          return (
            <TouchableOpacity style={styles.card} onPress={() => openRide(item)} activeOpacity={0.85}>
              <Text style={styles.route} numberOfLines={1}>
                {item.startAddress || item.depart || 'Depart'} -&gt; {item.endAddress || item.destination || 'Destination'}
              </Text>
              <Text style={styles.meta}>Depart: {formatDateTime(item.dateDepart)}</Text>
              <Text style={styles.meta}>Statut: {item.status}</Text>
              <Text style={styles.hint}>
                {canTrack
                  ? 'Appuyez pour ouvrir la carte de suivi.'
                  : 'Appuyez pour voir les informations du trajet.'}
              </Text>
            </TouchableOpacity>
          );
        }}
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
