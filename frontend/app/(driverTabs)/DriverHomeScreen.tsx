import React, { useCallback } from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Button from '../../components/Button';
import { useRide } from '../../context/RideContext';

export default function HomeScreen() {
  const { currentRide, getDriverActiveRide } = useRide();

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
        <Button
          title=" Ride Requests "
          onPress={() => router.push('../driver/RideRequestsScreen')}
          variant="primary"
          style={{ marginBottom: 12 }}
        />
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
});
