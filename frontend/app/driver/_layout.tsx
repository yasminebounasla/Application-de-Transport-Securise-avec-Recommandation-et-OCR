import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen
        name="Editprofilescreen"
        options={{
          title: "Edit Profile",
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { fontWeight: '800', fontSize: 20 },
          headerShadowVisible: true,
          headerBackTitle: '',
        }}
      />
      <Stack.Screen name="HomeScreen" />
      <Stack.Screen name="ActiveRideScreen" />
      <Stack.Screen
        name="DriverDashboardScreen"
        options={{
          title: "Dashboard",
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { fontWeight: '800', fontSize: 20 },
          headerShadowVisible: true,
          headerBackTitle: '',
        }}
      />
      <Stack.Screen name="ProfileSetupScreen" />
      <Stack.Screen name="MyFeedbacksScreen"
        options={{
          title: "Feedbacks",
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { fontWeight: '800', fontSize: 20 },
          headerShadowVisible: true,
          headerBackTitle: '',
        }}
      />

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
