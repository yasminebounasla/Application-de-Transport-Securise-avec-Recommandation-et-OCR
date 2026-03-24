import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="HomeScreen" />
      <Stack.Screen name="ActiveRideScreen" />
      <Stack.Screen name="ProfileSetupScreen" />
      <Stack.Screen name="MyFeedbacksScreen" />
      <Stack.Screen name="PassengerProfileScreen" options={{ 
        title: "Passenger Profile",
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
