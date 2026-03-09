import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.subtitle}>No notifications yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
});
