import { View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import Button from '../../components/Button';


export default function Home() {
  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 bg-white">

        <Button
          title="Open Search Ride"
          onPress={() => router.push('/passenger/SearchRideScreen')}
          variant="primary"
          style={{ marginTop: 16 }}
        />

        <Button 
          title="Request a Ride"
          onPress={() => router.push('/passenger/DemandeTrajetScreen')}
          variant="secondary"
          style={{ marginTop: 16 }}
        />

        <Button
          title="test feedback screen"
          onPress={() => router.push('/passenger/FeedbackScreen')}
          variant="primary"
          style={{ marginTop: 16 }}
        />
      
        </View>
    </ScrollView>

  );
}

