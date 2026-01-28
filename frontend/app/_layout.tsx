import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import '../global.css';

export default function Layout() {
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Home' }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="driver" options={{ headerShown: false }} />
        <Stack.Screen name="passenger" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}