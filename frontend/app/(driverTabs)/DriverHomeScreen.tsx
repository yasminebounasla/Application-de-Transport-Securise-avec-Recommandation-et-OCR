import { Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import Button from '../../components/Button';
import { Feather } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';


export default function HomeScreen() {
  return (
    
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 bg-white p-5">

        {/* Notification button */}
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push('/shared/NotificationsScreen' as any)}
        >
          <Feather name="bell" size={22} color="#000" />
        </TouchableOpacity>

        <Button 
          title=" Ride Requests "
          onPress={() => router.push('../driver/RideRequestsScreen')}
          variant="primary"
          style={{ marginBottom: 12  }}
        />
        <Button 
            title="ProfileSetup"
            onPress={() => router.push('../driver/ProfileSetupScreen')}
            variant="secondary"
            style={{ marginBottom: 12 }}
          />
          
          <Button 
          title=" My Feedbacks "
          onPress={() => router.push('../driver/MyFeedbacksScreen')}
          variant="primary"
          style={{ marginBottom: 12 }}
        />

        <Text>
          on fait un boutton de notification au header de le home screen 
        </Text>
        
      
      </View>
    </ScrollView>
  );
}


const styles = StyleSheet.create({

  notificationButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    zIndex: 1000,    
    elevation: 10
  },
})