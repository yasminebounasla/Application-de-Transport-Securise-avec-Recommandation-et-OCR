import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';

export default function RegisterPassengerScreen() {
    const { registerAsPassenger, loading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [familyName, setFamilyName] = useState('');
    const [age, setAge] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [error, setError] = useState('');

    const handleRegister = async () => {
        setError('');

        // Validation simple
        if (!email || !password || !confirmPassword || !firstName || !familyName || !age || !phoneNumber) {
            setError('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        const result = await registerAsPassenger({
            email,
            password,
            confirmPassword,
            firstName,
            familyName,
            age,
            phoneNumber
        });

        if (result.success) {
            Alert.alert(
                'Success!',
                'Your account has been created successfully',
                [
                    {
                        text: 'OK',
                        onPress: () => router.replace('./../../../passenger/HomeScreen'),
                    }
                ]
            );
        } else {
            setError(result.message);
        }
    };

    return (
        <>
            <Stack.Screen options={{ title: 'Create Account'}} />
            <ScrollView className="flex-1 bg-white">
                <View className="px-6 py-8">
                    {/* Header */}
                    <View className="mb-10">
                        <Text className="text-3xl font-bold text-black mb-2">
                            Register as Passenger
                        </Text>
                        <Text className="text-gray-500">
                            Fill in your details to get started
                        </Text>
                    </View>

                    {/* First Name */}
                    <View className="mb-4">
                        <Text className="text-sm font-medium text-black mb-2">First Name</Text>
                        <TextInput
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="First name"
                            editable={!loading}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    {/* Family Name */}
                    <View className="mb-4">
                        <Text className="text-sm font-medium text-black mb-2">Family Name</Text>
                        <TextInput
                            value={familyName}
                            onChangeText={setFamilyName}
                            placeholder="Family name"
                            editable={!loading}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    {/* Age */}
                    <View className="mb-4">
                        <Text className="text-sm font-medium text-black mb-2">Age</Text>
                        <TextInput
                            value={age}
                            onChangeText={setAge}
                            placeholder="25"
                            keyboardType="numeric"
                            editable={!loading}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    {/* Email */}
                    <View className="mb-4">
                        <Text className="text-sm font-medium text-black mb-2">Email</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="email@email.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            editable={!loading}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    {/* Phone Number */}
                    <View className="mb-4">
                        <Text className="text-sm font-medium text-black mb-2">Phone Number</Text>
                        <TextInput
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            placeholder="+213 XXX XXX XXX"
                            keyboardType="phone-pad"
                            editable={!loading}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    {/* Password */}
                    <View className="mb-4">
                        <Text className="text-sm font-medium text-black mb-2">Password</Text>
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            placeholder="••••••••"
                            secureTextEntry
                            editable={!loading}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    {/* Confirm Password */}
                    <View className="mb-6">
                        <Text className="text-sm font-medium text-black mb-2">Confirm Password</Text>
                        <TextInput
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="••••••••"
                            secureTextEntry
                            editable={!loading}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    {/* Error */}
                    {error ? (
                        <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
                            <Text className="text-red-600 text-sm">{error}</Text>
                        </View>
                    ) : null}

                    {/* Submit */}
                    <TouchableOpacity
                        onPress={handleRegister}
                        disabled={loading}
                        className={`rounded-xl py-5 items-center mb-4 ${loading ? 'bg-gray-400' : 'bg-black'}`}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white text-base font-semibold">Create Account</Text>
                        )}
                    </TouchableOpacity>

                    {/* Login Link */}
                    <View className="flex-row justify-center">
                        <Text className="text-gray-600">Already have an account? </Text>
                        <TouchableOpacity onPress={() => router.push('./LoginPassengerScreen')}>
                            <Text className="text-black font-semibold">Sign In</Text>
                        </TouchableOpacity>
                    </View>

                    <View className="h-8" />
                </View>
            </ScrollView>
        </>
    );
}
