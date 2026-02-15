import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="HomeScreen" />
      <Stack.Screen name="ActiveRideScreen" />
      <Stack.Screen name="ProfileSetupScreen" />
      <Stack.Screen name="RideRequestScreen" />
      <Stack.Screen name="MyFeedbacksScreen" />
    </Stack>
  );
}
