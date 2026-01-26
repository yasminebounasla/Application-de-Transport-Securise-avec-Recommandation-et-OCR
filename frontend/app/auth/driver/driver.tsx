import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function DriverHome() {
  return (
    <View className="flex-1 bg-white px-6">
      <View className="flex-1 justify-center">
        {/* Header */}
        <View className="mb-12">
          <Text className="text-4xl font-bold text-black mb-2">
            Driver
          </Text>
          <Text className="text-gray-600 text-base">
            Access your driver account
          </Text>
        </View>

        {/* Buttons */}
        <View className="space-y-4">
          <TouchableOpacity
            onPress={() => router.push('/auth/driver/LoginDriverScreen')}
            className="bg-black rounded-2xl py-5 mb-4"
          >
            <Text className="text-white text-center text-lg font-semibold">
              Login
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/auth/driver/RegisterDriverScreen')}
            className="bg-white border-2 border-gray-300 rounded-2xl py-5"
          >
            <Text className="text-black text-center text-lg font-semibold">
              Register as Driver
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Link */}
        <View className="mt-8">
          <Text className="text-center text-gray-500 text-sm">
            Want to earn money? Register and start driving
          </Text>
        </View>
      </View>
    </View>
  );
}