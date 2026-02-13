import { View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import Button from '../../components/Button';

export default function HomeScreen() {
  return (
    
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 bg-white p-5">

        <Button 
          title=" Ride Requests "
          onPress={() => router.push('/driver/RideRequestsScreen')}
          variant="primary"
          style={{ marginBottom: 12 }}
        />
      
      </View>
    </ScrollView>
  );
}