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
      tabBarActiveTintColor: "#000000",
      tabBarInactiveTintColor: "#666666"
    }}>

    <Tabs.Screen  
      name="PassengerHomeScreen" 
      options={{
       title: "Home",
       headerShown: false,  // ← supprime la bande "Home"
        tabBarIcon: ({ color, size }) => (
         <MaterialCommunityIcons name="home" size={size} color={color} />
        ),
      }}
    />

    <Tabs.Screen  
        name="MesTrajets" 
        options={{
          title : "Mes Trajets",
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
     name="PassengerProfile" 
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