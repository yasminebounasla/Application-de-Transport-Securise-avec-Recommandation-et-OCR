import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function HomeHeader() {
  return (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>Accueil</Text>
    </View>
  );
}

function SimpleHeader({ title }) {
  return (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs screenOptions={{ 
      headerStyle: { backgroundColor: "#ffffff" },
      headerShown: false,
      tabBarStyle: {
        backgroundColor: "#ffffff",
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
        elevation: 0,
        shadowOpacity: 0,
        height: 60 + insets.bottom,
        paddingBottom: insets.bottom,
        paddingTop: 5,
        position: "absolute"
      },
      tabBarActiveTintColor: "#111111",
      tabBarInactiveTintColor: "#bbbbbb",
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: "600",
      }
    }}>

      <Tabs.Screen  
        name="PassengerHomeScreen" 
        options={{
          headerShown: true,
          header: () => <HomeHeader />,
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? "home-variant" : "home-variant-outline"} 
              size={size + 2} 
              color={color} 
            />
          ),
          title: "Accueil"
        }}
      />

      <Tabs.Screen  
        name="MesTrajets" 
        options={{
          headerShown: true,
          header: () => <SimpleHeader title="Mes Trajets" />,
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? "car" : "car-outline"} 
              size={size + 2} 
              color={color} 
            />
          ),
          title: "Trajets"
        }}
      />

      <Tabs.Screen  
        name="PassengerProfile" 
        options={{
          headerShown: true,
          header: () => <SimpleHeader title="Profil" />,
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? "account-circle" : "account-circle-outline"} 
              size={size + 2} 
              color={color} 
            />
          ),
          title: "Profil"
        }}
      />

    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: "#ffffff",
    paddingTop: 55,
    paddingBottom: 14,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: {
    color: "#111111",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});