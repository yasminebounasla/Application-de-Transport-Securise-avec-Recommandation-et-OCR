import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';

export default function LoginDriverScreen() {
    const { loginAsDriver, loading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async () => {
        setError('');
        
        // Validation
        if (!email || !password) {
            setError('Please fill in all fields');
            return;
        }

        const result = await loginAsDriver(email, password);
        
        if (result.success) {
            Alert.alert(
                'Success!',
                'You have successfully logged in.',
                [
                    {
                        text: 'OK',
                        onPress: () => router.replace('./../../../driver/HomeScreen'),
                    }
                ]
            );
        } else {
            setError(result.message);
        }
    };

    return (
        <>
            <Stack.Screen options={{ title: 'Sign In' }} />
            <ScrollView className="flex-1 bg-white">
                <View className="px-6 py-8">
                    {/* Header */}
                    <View className="mb-10">
                        <Text className="text-3xl font-bold text-black mb-2">
                            Sign In as Driver
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
                            editable={!loading}
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
                            editable={!loading}
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
                        disabled={loading}
                        className={`rounded-xl py-5 items-center mb-4 ${loading ? 'bg-gray-400' : 'bg-black'}`}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white text-base font-semibold">Sign In</Text>
                        )}
                    </TouchableOpacity>

                    {/* Register Link */}
                    <View className="flex-row justify-center">
                        <Text className="text-gray-600">Don't have an account? </Text>
                        <TouchableOpacity onPress={() => router.push('./RegisterDriverScreen')}>
                            <Text className="text-black font-semibold">Register</Text>
                        </TouchableOpacity>
                    </View>

                    <View className="h-8" />
                </View>
            </ScrollView>
        </>
    );
}