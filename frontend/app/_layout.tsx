import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { LocationProvider } from '../context/LocationContext';
import '../global.css';

export default function Layout() {
  return (
    <AuthProvider>
      <LocationProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Home' }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="driver" options={{ headerShown: false }} />
        <Stack.Screen name="passenger" options={{ headerShown: false }} />
        <Stack.Screen name="shared/MapScreen" options={{ title: 'Map' }} />
      </Stack>
      </LocationProvider>
    </AuthProvider>
  );
}
