import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="EditProfileScreen" />
      <Stack.Screen name="HomeScreen" />
      <Stack.Screen name="SearchRideScreen" />
      <Stack.Screen name="RecommendedDriversScreen" options={{ headerShown: false }} />
      <Stack.Screen name="DemandeTrajetScreen" />
      <Stack.Screen name="HistoryScreen" />
      <Stack.Screen name="RideTrackingScreen" />
      <Stack.Screen name="FeedbackScreen" />
      <Stack.Screen name="NotificationScreen" options={{ headerShown: false }} />
      <Stack.Screen name="DriverProfileScreen" options={{
        title: "Driver Profile",
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 20,
        },
        headerShadowVisible: true,
        headerBackTitle: '',  // cache le texte "back" sur iOS
      }} />
    </Stack>
  );
}
