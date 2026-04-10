import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useRide } from '../../context/RideContext';

const parseHeureDepart = (value?: string) => {
  if (!value) return null;
  const parts = String(value).trim().split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
};

const getDepartAt = (ride: any) => {
  if (!ride?.dateDepart) return null;
  const d = new Date(ride.dateDepart);
  if (Number.isNaN(d.getTime())) return null;

  const hm = parseHeureDepart(ride.heureDepart);
  if (hm) d.setHours(hm.h, hm.m, 0, 0);

  return d;
};

const formatDateTime = (dateValue?: string | Date) => {
  if (!dateValue) return 'Date non definie';
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
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
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = Date.now();

    const map = new Map();
    (driverRequests || []).forEach((ride: any) => {
      if (ride.status === 'ACCEPTED' || ride.status === 'IN_PROGRESS') {
       map.set(ride.id, ride);
      }
    });
    if (currentRide && (currentRide.status === 'ACCEPTED' || currentRide.status === 'IN_PROGRESS')) {
      map.set(currentRide.id, currentRide);
    }

    return Array.from(map.values())
      .filter((ride: any) => {
       if (ride.status === 'IN_PROGRESS') return true; // toujours visible
       const departAt = getDepartAt(ride);
       if (!departAt) return false;
       const diff = departAt.getTime() - now;
       return diff >= 0 && diff <= ONE_HOUR_MS;
     })
      .sort(
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
        <Text style={styles.emptyTitle}>Aucun trajet dans moins d'1 heure</Text>
        <Text style={styles.subtle}>Les trajets ACCEPTED qui demarrent bientot apparaitront ici.</Text>
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
            <Text style={styles.meta}>Depart: {formatDateTime(getDepartAt(item) || item.dateDepart)}</Text>
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

