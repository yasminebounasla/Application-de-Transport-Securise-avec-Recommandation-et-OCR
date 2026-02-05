import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="HomeScreen" />
      <Stack.Screen name="SearchRideScreen" />
      <Stack.Screen name="RecommendationDriverScreen" />
    </Stack>
  );
}
