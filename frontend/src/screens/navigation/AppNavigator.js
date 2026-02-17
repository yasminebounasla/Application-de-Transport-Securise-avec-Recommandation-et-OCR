import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

// Passenger screens
import PassengerHome from '../../../app/passenger/HomeScreen';
import SearchRideScreen from '../../../app/passenger/SearchRideScreen';
import RecommendedDriversScreen from '../../../app/passenger/RecommendedDriversScreen';
import HistoryScreen from '../../../app/passenger/HistoryScreen';
import PassengerFeedback from '../../../app/passenger/FeedbackScreen';

// Driver screens
import DriverHome from '../../../app/driver/HomeScreen';
import RideRequestsScreen from '../../../app/driver/RideRequestsScreen';
import ActiveRideScreen from '../../../app/driver/ActiveRideScreen';
import ProfileSetupScreen from '../../../app/driver/ProfileSetupScreen';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

function PassengerTabs() {
	return (
		<Tab.Navigator screenOptions={({ route }) => ({
			headerShown: false,
			tabBarIcon: ({ color, size }) => {
				let name = 'help-outline';
				if (route.name === 'Home') name = 'home';
				else if (route.name === 'Search') name = 'search';
				else if (route.name === 'Recommended') name = 'people';
				else if (route.name === 'History') name = 'history';
				else if (route.name === 'Feedback') name = 'feedback';
				return <MaterialIcons name={name} size={size} color={color} />;
			},
		})}>
			<Tab.Screen name="Home" component={PassengerHome} />
			<Tab.Screen name="Search" component={SearchRideScreen} />
			<Tab.Screen name="Recommended" component={RecommendedDriversScreen} />
			<Tab.Screen name="History" component={HistoryScreen} />
			<Tab.Screen name="Feedback" component={PassengerFeedback} />
		</Tab.Navigator>
	);
}

function DriverTabs() {
	return (
		<Tab.Navigator screenOptions={({ route }) => ({
			headerShown: false,
			tabBarIcon: ({ color, size }) => {
				let name = 'help-outline';
				if (route.name === 'Home') name = 'directions-car';
				else if (route.name === 'Requests') name = 'list-alt';
				else if (route.name === 'Active') name = 'play-circle-filled';
				else if (route.name === 'Profile') name = 'person';
				return <MaterialIcons name={name} size={size} color={color} />;
			},
		})}>
			<Tab.Screen name="Home" component={DriverHome} />
			<Tab.Screen name="Requests" component={RideRequestsScreen} />
			<Tab.Screen name="Active" component={ActiveRideScreen} />
			<Tab.Screen name="Profile" component={ProfileSetupScreen} />
		</Tab.Navigator>
	);
}

export default function AppNavigator() {
	const { user } = useAuth() || {};

	return (
		<NavigationContainer independent={true}>
			<Drawer.Navigator screenOptions={{ headerShown: false }}>
				<Drawer.Screen name="Main">
					{() => (user?.role === 'driver' ? <DriverTabs /> : <PassengerTabs />)}
				</Drawer.Screen>
			</Drawer.Navigator>
		</NavigationContainer>
	);
}

