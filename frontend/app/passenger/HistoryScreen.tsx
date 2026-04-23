import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useRide } from '../../context/RideContext';
import { formatPhoneNumberForDisplay } from '../../utils/phoneNumber';

const formatDateTime = (dateValue?: string) => {
  if (!dateValue) return 'Date non definie';
  return new Date(dateValue).toLocaleString();
};

export default function HistoryScreen() {
  const { trajetId } = useLocalSearchParams<{ trajetId: string }>();
  const { getRideById } = useRide();
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trajetId) return;

    const loadRide = async () => {
      try {
        const data = await getRideById(trajetId);
        setRide(data);
      } catch (error) {
        console.error('Erreur chargement trajet:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRide();
  }, [trajetId, getRideById]);

  const minutesLeft = useMemo(() => {
    if (!ride?.dateDepart) return null;
    return Math.round((new Date(ride.dateDepart).getTime() - Date.now()) / 60000);
  }, [ride]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
        <Text style={styles.subtle}>Chargement...</Text>
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Trajet introuvable</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Informations du trajet</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Depart</Text>
        <Text style={styles.value}>{ride.startAddress || 'N/A'}</Text>

        <Text style={styles.label}>Destination</Text>
        <Text style={styles.value}>{ride.endAddress || 'N/A'}</Text>

        <Text style={styles.label}>Date de depart</Text>
        <Text style={styles.value}>{formatDateTime(ride.dateDepart)}</Text>

        <Text style={styles.label}>Statut</Text>
        <Text style={styles.value}>{ride.status}</Text>

        {!!ride.driver && (
          <>
            <Text style={styles.label}>Conducteur</Text>
            <Text style={styles.value}>
              {ride.driver.prenom} {ride.driver.nom} - {formatPhoneNumberForDisplay(ride.driver.numTel)}
            </Text>
          </>
        )}

        <Text style={styles.note}>
          {minutesLeft !== null && minutesLeft > 60
            ? 'La carte sera disponible quand il restera moins de 1 heure avant le depart.'
            : 'La carte de suivi est disponible depuis Mes Trajets.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F6F6', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 16 },
  subtle: { color: '#666', marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  label: { marginTop: 10, fontSize: 12, color: '#666', fontWeight: '600', textTransform: 'uppercase' },
  value: { fontSize: 15, color: '#111', marginTop: 4 },
  note: { marginTop: 16, fontSize: 13, color: '#2563EB', fontWeight: '600' },
});
