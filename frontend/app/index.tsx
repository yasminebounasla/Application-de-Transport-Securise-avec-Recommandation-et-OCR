import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function Home() {
  return (
    <View className="flex-1 bg-white">
      {/* Header Section */}
      <View className="flex-1 justify-center items-center px-6">
        <Text className="text-5xl font-bold text-black mb-3">Welcome</Text>
        <Text className="text-lg text-gray-600 text-center mb-12">
          Choose how you want to continue
        </Text>

        {/* Role Selection Buttons */}
        <View className="w-full max-w-sm">
          <TouchableOpacity
            onPress={() => router.push('/auth/driver/driver')}
            className="bg-black rounded-2xl py-5 mb-4 shadow-lg"
          >
            <Text className="text-white text-center text-lg font-semibold">
              I'm a Driver
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/auth/passenger/passenger')}
            className="bg-white border-2 border-black rounded-2xl py-5"
          >
            <Text className="text-black text-center text-lg font-semibold">
              I'm a Passenger
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <View className="pb-8 px-6">
        <Text className="text-center text-gray-500 text-sm">
          Safe rides, every time
        </Text>
      </View>
    </View>
  );
}