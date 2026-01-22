import { View, Text, Button } from 'react-native';
import { router } from 'expo-router';

export default function Home() {
  return (
    <View style={{ padding: 20 }}>
      <Text>Welcome to Transport App</Text>

      <Button
        title="Register as Passenger"
        onPress={() => router.push('/auth/RegisterPassengerScreen')}
      />

      <Button
        title="Register as Driver"
        onPress={() => router.push('/auth/RegisterDriverScreen')}
      />
    </View>
  );
}
