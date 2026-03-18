import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Button from '../../components/Button';
import { useRide } from '../../context/RideContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <MaterialIcons name={icon as any} size={20} color="#111" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { currentRide, getDriverActiveRide } = useRide();
  const [activityStats, setActivityStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    cancelled: 0,
    completionRate: 0,
  });

  useFocusEffect(
    useCallback(() => {
      getDriverActiveRide();
    }, [getDriverActiveRide])
  );

  const inProgressRide = currentRide && currentRide.status === 'IN_PROGRESS' ? currentRide : null;
  const openInProgress = () => {
    if (!inProgressRide) return;
    router.push({
      pathname: '/driver/ActiveRideScreen',
      params: { trajetId: String(inProgressRide.id) },
    });
  };

  useEffect(() => {
    const loadStats = async () => {
      if (!user?.id) return;
      try {
        const response = await api.get(`/rides/activity/driver/${user.id}`);
        const rides = response?.data?.data || [];
        const completed = rides.filter((ride: any) => ride.status === 'COMPLETED').length;
        const pending = rides.filter((ride: any) => ['ACCEPTED'].includes(ride.status)).length;
        const cancelled = rides.filter((ride: any) => ['CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER'].includes(ride.status)).length;
        const total = rides.length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        setActivityStats({ total, completed, pending, cancelled, completionRate });
      } catch (error) {
        console.error('Failed to load driver home activity stats:', error);
      }
    };

    loadStats();
  }, [user?.id]);

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 bg-white p-5">
        {inProgressRide && (
          <TouchableOpacity style={styles.activeCard} activeOpacity={0.85} onPress={openInProgress}>
            <Text style={styles.activeTitle}>Trajet en cours</Text>
            <Text style={styles.activeRoute} numberOfLines={1}>
              {inProgressRide.startAddress || inProgressRide.depart || 'Depart'} -&gt; {inProgressRide.endAddress || inProgressRide.destination || 'Destination'}
            </Text>
            <Text style={styles.activeHint}>Ouvrir la carte -&gt;</Text>
          </TouchableOpacity>
        )}
        <View style={styles.statsGrid}>
          <StatCard icon="list-alt" label="Total" value={activityStats.total} />
          <StatCard icon="flag" label="Termines" value={activityStats.completed} />
          <StatCard icon="hourglass-empty" label="Accepted" value={activityStats.pending} />
          <StatCard icon="cancel" label="Cancelled" value={activityStats.cancelled} />
          <StatCard icon="percent" label="Taux succes" value={`${activityStats.completionRate}%`} />
        </View>
        <Button
          title="ProfileSetup"
          onPress={() => router.push('../driver/ProfileSetupScreen')}
          variant="secondary"
          style={{ marginBottom: 12 }}
        />
        <Button
          title=" My Feedbacks "
          onPress={() => router.push('../driver/MyFeedbacksScreen')}
          variant="primary"
          style={{ marginBottom: 12 }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  activeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  activeTitle: { color: '#111', fontSize: 14, fontWeight: '900', marginBottom: 6 },
  activeRoute: { color: '#111', fontSize: 13, fontWeight: '700', opacity: 0.95 },
  activeHint: { color: '#2563EB', marginTop: 8, fontSize: 12, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: { width: '31%', backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#ECECEC', paddingVertical: 14, alignItems: 'center' },
  statValue: { marginTop: 6, fontSize: 20, fontWeight: '700', color: '#111' },
  statLabel: { marginTop: 2, fontSize: 12, color: '#666', fontWeight: '600' },
});
