import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { loginDriver, loginPassenger } from '../../../services/authService';

export default function LoginDriverScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async () => {
        try {
            const data = await loginPassenger({
                email,
                password
            });
            console.log('Login successful:', data);

            Alert.alert(
                'Success!',
                'You have successfully logged in.',
                [
                    {
                        text: 'OK',
                        onPress: () => router.push('./../../../Passenger/HomeScreen'), 
                    }
                ]
            );

        } catch (error: any) {
            setError(
                error.response?.data?.message || 'Something went wrong'
            );
        }
    }

    return (
        <>
            <Stack.Screen options={{ title: 'Sign In' }} />
            <ScrollView className="flex-1 bg-white">
                <View className="px-6 py-8">
                    {/* Header */}
                    <View className="mb-10">
                        <Text className="text-3xl font-bold text-black mb-2">
                            Sign In as Passenger
                        </Text>
                        <Text className="text-gray-500">
                            Enter your credentials to sign in
                        </Text>
                    </View>

                    {/* Form Fields */}
                    <View className="mb-4">
                        <Text className="text-sm font-medium text-black mb-2">Email</Text>
                        <TextInput 
                            value={email} 
                            onChangeText={setEmail} 
                            placeholder='email@email.com' 
                            keyboardType='email-address'
                            autoCapitalize='none'
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View className="mb-4">
                        <Text className="text-sm font-medium text-black mb-2">Password</Text>
                        <TextInput 
                            value={password} 
                            onChangeText={setPassword} 
                            placeholder='••••••••' 
                            secureTextEntry 
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    {/* Error Message */}
                    {error ? (
                        <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
                            <Text className="text-red-600 text-sm">{error}</Text>
                        </View>
                    ) : null}

                    {/* Submit Button */}
                    <TouchableOpacity 
                        onPress={handleLogin}
                        className="bg-black rounded-xl py-5 items-center mb-4"
                    >
                        <Text className="text-white text-base font-semibold">Sign In</Text>
                    </TouchableOpacity>

                    <View className="h-8" />
                </View>
            </ScrollView>
        </>
    );
}