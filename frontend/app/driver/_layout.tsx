import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="EditProfileScreen" />
      <Stack.Screen name="HomeScreen" />
      <Stack.Screen name="ActiveRideScreen" />
      <Stack.Screen
        name="DriverDashboardScreen"
        options={{
          title: "Driver Dashboard",
          headerStyle: { backgroundColor: '#060B16' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { color: '#FFFFFF', fontWeight: '800' },
        }}
      />
      <Stack.Screen name="ProfileSetupScreen" />
      <Stack.Screen name="MyFeedbacksScreen" />
      <Stack.Screen name="PassengerProfileScreen" options={{
        title: "Passenger Profile",
        headerShown: false,
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
