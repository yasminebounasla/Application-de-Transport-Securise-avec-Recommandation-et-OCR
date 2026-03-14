import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import api from '../../../services/api';

const formatDurationMin = (durationMin: number) => {
  const minutes = Math.max(0, Math.round(durationMin));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const mm = String(m).padStart(2, '0');
  return `${h} h ${mm} min`;
};

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <MaterialIcons name={icon as any} size={18} color="#444" />
      <Text style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}:</Text> {value}
      </Text>
    </View>
  );
}

export default function RideDetailsScreen() {
  const { rideId } = useLocalSearchParams<{ rideId?: string }>();
  const id = useMemo(() => (rideId ? Number.parseInt(String(rideId), 10) : NaN), [rideId]);
  const headerTitle = Number.isFinite(id) ? `Trajet #${id}` : 'Trajet';
  const FALLBACK = '------------------';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ride, setRide] = useState<any | null>(null);
  const [estimatedDurationLabel, setEstimatedDurationLabel] = useState<string>(FALLBACK);

  useEffect(() => {
    const load = async () => {
      if (!Number.isFinite(id)) {
        setError('Ride ID invalide.');
        setLoading(false);
        return;
      }
      try {
        setError('');
        setLoading(true);
        const response = await api.get(`/ridesDem/${id}`);
        setRide(response?.data?.data || null);
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Impossible de charger le trajet.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    let mounted = true;

    const startLat = Number(ride?.startLat);
    const startLng = Number(ride?.startLng);
    const endLat = Number(ride?.endLat);
    const endLng = Number(ride?.endLng);

    // We can only estimate if the ride has coordinates.
    if (![startLat, startLng, endLat, endLng].every((n) => Number.isFinite(n))) {
      setEstimatedDurationLabel(FALLBACK);
      return () => { mounted = false; };
    }

    (async () => {
      try {
        setEstimatedDurationLabel('...');
        const response = await api.post('/ride/estimate', {
          start: { latitude: startLat, longitude: startLng },
          end: { latitude: endLat, longitude: endLng },
        });
        const data = response?.data;
        const durationMin = Number(data?.durationMin);
        const label = Number.isFinite(durationMin) ? formatDurationMin(durationMin) : FALLBACK;
        if (mounted) setEstimatedDurationLabel(label);
      } catch {
        if (mounted) setEstimatedDurationLabel(FALLBACK);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [ride?.startLat, ride?.startLng, ride?.endLat, ride?.endLng]);

  const dateLabel = ride?.dateDepart ? new Date(ride.dateDepart).toLocaleDateString() : FALLBACK;
  const timeLabel = ride?.heureDepart || FALLBACK;
  const showStart = ride?.status === 'IN_PROGRESS' || ride?.status === 'COMPLETED';
  const startAtLabel =
    showStart && (ride?.dateDepart || ride?.heureDepart)
      ? `${ride?.dateDepart ? new Date(ride.dateDepart).toLocaleDateString() : ''} ${ride?.heureDepart || ''}`.trim()
      : FALLBACK;
  const start = ride?.startAddress || ride?.depart || FALLBACK;
  const end = ride?.endAddress || ride?.destination || FALLBACK;
  const status = ride?.status || FALLBACK;
  const price = typeof ride?.prix === 'number' ? ride.prix : Number(ride?.prix) || 0;

  const passengerName =
    ride?.passenger ? `${ride.passenger.prenom || ''} ${ride.passenger.nom || ''}`.trim() : FALLBACK;

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: headerTitle }} />
        <ActivityIndicator size="large" color="#111" />
        <Text style={styles.centerText}>Chargement du trajet...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: headerTitle }} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: headerTitle }} />
        <Text style={styles.centerText}>Trajet introuvable.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: headerTitle }} />
      <View style={styles.card}>
        <Text style={styles.title}>Trajet #{ride.id}</Text>
        <Row icon="my-location" label="Depart" value={start} />
        <Row icon="location-on" label="Arrivee" value={end} />
        <Row icon="event" label="Date" value={dateLabel} />
        <Row icon="schedule" label="Heure" value={timeLabel} />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Details</Text>
        <Row icon="info" label="Status" value={status} />
        <Row icon="payments" label="Prix" value={`${price.toFixed(2)} DA`} />
        <Row icon="person" label="Passager" value={passengerName || FALLBACK} />
        <Row icon="phone" label="Tel passager" value={ride?.passenger?.numTel ? String(ride.passenger.numTel) : FALLBACK} />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Horodatage</Text>
        <Row
          icon="schedule"
          label="Cree le"
          value={ride?.createdAt ? new Date(ride.createdAt).toLocaleString() : FALLBACK}
        />
        <Row icon="timer" label="Temps estime" value={estimatedDurationLabel} />
        <Row icon="directions-car" label="Demarre le" value={startAtLabel} />
        <Row
          icon="flag"
          label="Termine le"
          value={ride?.completedAt ? new Date(ride.completedAt).toLocaleString() : FALLBACK}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 28, backgroundColor: '#F5F5F5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#F5F5F5' },
  centerText: { marginTop: 10, color: '#666', fontSize: 14, fontWeight: '600' },
  errorText: { color: '#B42318', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  card: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 10 },
  section: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  rowText: { flex: 1, color: '#333', fontSize: 13 },
  rowLabel: { fontWeight: '800', color: '#111' },
});
