import { View, Text, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import Input from '../../../components/Input';
import Button from '../../../components/Button';

export default function LoginDriverScreen() {
    const { loginAsDriver, loading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async () => {
        setError('');
        
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
                        onPress: () => router.replace('./../../../(driverTabs)/DriverHomeScreen'),
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
                    <Input
                        label="Email"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="email@email.com"
                        keyboardType="email-address"
                        style={{ marginBottom: 16 }}
                    />

                    <Input
                        label="Password"
                        value={password}
                        onChangeText={setPassword}
                        placeholder="••••••••"
                        secureTextEntry
                        style={{ marginBottom: 16 }}
                    />

                    {/* Error Message */}
                    {error ? (
                        <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
                            <Text className="text-red-600 text-sm">{error}</Text>
                        </View>
                    ) : null}

                    {/* Submit Button */}
                    <Button
                        title="Sign In"
                        onPress={handleLogin}
                        variant="primary"
                        loading={loading}
                        style={{ marginBottom: 16 }}
                    />

                    {/* Register Link */}
                    <View className="flex-row justify-center">
                        <Text className="text-gray-600">Don't have an account? </Text>
                        <Text 
                            onPress={() => router.push('./RegisterDriverScreen')}
                            className="text-black font-semibold"
                        >
                            Register
                        </Text>
                    </View>

                    <View className="h-8" />
                </View>
            </ScrollView>
        </>
    );
}