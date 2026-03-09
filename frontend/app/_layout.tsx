import { Stack } from 'expo-router';
import { Alert, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider } from '../context/AuthContext';
import { LocationProvider } from '../context/LocationContext';
import { RideProvider } from '../context/RideContext';
import '../global.css';

export default function Layout() {
  return (
    <AuthProvider>
      <LocationProvider>
        <RideProvider>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen
              name="(driverTabs)"
              options={{
                title: '(driver tabs)',
                headerRight: () => (
                  <Pressable
                    onPress={() => Alert.alert('Notifications', 'No new notifications for now.')}
                    style={{ marginRight: 12 }}
                  >
                    <Ionicons name="notifications-outline" size={22} color="#111" />
                  </Pressable>
                ),
              }}
            />
            <Stack.Screen
              name="(passengerTabs)"
              options={{
                title: '(passenger tabs)',
                headerRight: () => (
                  <Pressable
                    onPress={() => Alert.alert('Notifications', 'No new notifications for now.')}
                    style={{ marginRight: 12 }}
                  >
                    <Ionicons name="notifications-outline" size={22} color="#111" />
                  </Pressable>
                ),
              }}
            />
            <Stack.Screen name="driver" options={{ headerShown: false }} />
            <Stack.Screen name="passenger" options={{ headerShown: false }} />
            <Stack.Screen name="shared/MapScreen" options={{ title: 'Map' }} />
          </Stack>
        </RideProvider>
      </LocationProvider>
    </AuthProvider>
  );
}
