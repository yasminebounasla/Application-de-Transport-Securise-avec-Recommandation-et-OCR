import React from 'react';
import { Text, View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Button from '../../components/Button';
import { Feather } from '@expo/vector-icons';
import { useNotifications } from '../../context/NotificationContext';

export default function HomeScreen() {
  
  const { notifications, unreadCount } = useNotifications();
  const unreadNotifications = unreadCount; // ← plus notifications.length

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 bg-white p-5">

        {/* Notification button avec badge */}
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push('/shared/NotificationsScreen' as any)}
        >
          <Feather name="bell" size={22} color="#000" />
          {unreadNotifications > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadNotifications}</Text>
            </View>
          )}
        </TouchableOpacity>

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
  notificationButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    zIndex: 1000,
    elevation: 10,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'red',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
});