import { Tabs, router } from "expo-router";
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { TouchableOpacity, View, Text } from 'react-native';
import { useNotifications } from '../../context/NotificationContext';
import ReminderModal from '../shared/ReminderModel';

function NotificationButton() {
  const { unreadCount } = useNotifications();
  return (
    <TouchableOpacity
      onPress={() => router.push('/shared/NotificationsScreen' as any)}
      style={{
        marginRight: 16,
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#F0F0F2',
        justifyContent: 'center', alignItems: 'center',
      }}
    >
      <Feather name="bell" size={22} color="#000" />
      {unreadCount > 0 && (
        <View style={{
          position: 'absolute', top: -4, right: -4,
          backgroundColor: '#E53E3E', borderRadius: 8,
          width: 16, height: 16, justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>{unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function DriverTabsLayout() {
  return (
    <>
      <Tabs screenOptions={{
        headerRight: () => <NotificationButton />,
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 22,
        },
        headerStyle: {
          backgroundColor: '#ffffff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 4,
        },
        tabBarStyle: {
          backgroundColor: "#f5f5f5",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: "#000000",
        tabBarInactiveTintColor: "#666666",
      }}>
        <Tabs.Screen
          name="DriverHomeScreen"
          options={{
            title: "Home",
            headerShown: true,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="MesTrajets"
          options={{
            title: "Trips",
            headerShown: true,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="car" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="Activity"
          options={{
            title: "Activity",
            headerShown: true,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="history" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="DriverProfile"
          options={{
            title: "Profile",
            headerShown: true,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="account" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    <ReminderModal />
    </>
  );
}
