import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ 
      headerStyle : { backgroundColor:"#f5f5f5"},
      headerShadowVisible: false, 
      tabBarStyle: {
        backgroundColor:"#f5f5f5",
        borderTopWidth: 0,
        elevation: 0,
        shadowOpacity: 0
      },
      tabBarActiveTintColor: "#6200ee",
      tabBarInactiveTintColor: "#666666"
    }}>

      <Tabs.Screen  
        name="DriverHomeScreen" 
        options={{
          title : "Home",
          tabBarIcon : ({color, size}) => (
            <MaterialCommunityIcons 
              name="home" 
              size={size} 
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen  
        name="Activity" 
        options={{
          title : "Activity",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="car"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen  
  name="DriverProfile" 
  options={{
    title: "Profile",
    headerShown: false, 
    tabBarIcon: ({ color, size }) => (
      <MaterialCommunityIcons name="account" size={size} color={color} />
    ),
  }}
/>

    </Tabs>
)}