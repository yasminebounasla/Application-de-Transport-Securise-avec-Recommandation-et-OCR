import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { LocationProvider } from '../context/LocationContext';
import { RideProvider } from '../context/RideContext';
import '../global.css';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NotificationProvider } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

// ✅ Composant séparé pour attendre que l'auth soit prête
function AppContent() {
  const { loading } = useAuth();

  if (loading) return null; // attend que le user soit chargé

  return (
    <NotificationProvider>
      <LocationProvider>
        <RideProvider>
          <SafeAreaProvider>
            <Stack>
              <Stack.Screen name="index" options={{ title: 'Home' }} />
              <Stack.Screen name="auth" options={{ headerShown: false }} />
              <Stack.Screen name="driver" options={{ headerShown: false }} />
              <Stack.Screen name="passenger" options={{ headerShown: false }} />
              <Stack.Screen name="shared/MapScreen" options={{ title: 'Map' }} />
              <Stack.Screen name="(passengerTabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(driverTabs)" options={{ headerShown: false }} />
            </Stack>
          </SafeAreaProvider>
        </RideProvider>
      </LocationProvider>
    </NotificationProvider>
  );
}

export default function Layout() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}