import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { registerPassenger } from '../../../services/authService';

export default function RegisterPassengerScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [familyName, setFamilyName] = useState('');
    const [age, setAge] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [error, setError] = useState('');

    const handleRegister = async () => {
        try {
            const data = await registerPassenger({
                email,
                password,
                confirmPassword,
                firstName,
                familyName,
                age,
                phoneNumber
            });
            console.log('Registration successful:', data);
            Alert.alert(
                            'Success!',
                            'Your account has been created successfully',
                            [
                                {
                                    text: 'OK',
                                    onPress: () => router.push('./../../../passenger/HomeScreen'), 
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
            <Stack.Screen options={{ title: 'Create Account'}} />
            <ScrollView className="flex-1 bg-white">
                <View className="px-6 py-8">
                    {/* Header */}
                    <View className="mb-10">
                        <Text className="text-3xl font-bold text-black mb-2">
                            Join as Passenger
                        </Text>
                        <Text className="text-gray-500">
                            Fill in your details to get started
                        </Text>
                    </View>

                    {/* Form Fields */}
                    <View className="mb-4">
                        <Text className="text-sm font-medium text-black mb-2">First Name</Text>
                        <TextInput 
                            value={firstName} 
                            onChangeText={setFirstName} 
                            placeholder='first name' 
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View className="mb-4">
                        <Text className="text-sm font-medium text-black mb-2">Family Name</Text>
                        <TextInput 
                            value={familyName} 
                            onChangeText={setFamilyName} 
                            placeholder='family name' 
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View className="mb-4">
                        <Text className="text-sm font-medium text-black mb-2">Age</Text>
                        <TextInput 
                            value={age} 
                            onChangeText={setAge} 
                            placeholder='25' 
                            keyboardType='numeric' 
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

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
                        <Text className="text-sm font-medium text-black mb-2">Phone Number</Text>
                        <TextInput 
                            value={phoneNumber} 
                            onChangeText={setPhoneNumber} 
                            placeholder='+213 XXX XXX XXX' 
                            keyboardType='phone-pad' 
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

                    <View className="mb-6">
                        <Text className="text-sm font-medium text-black mb-2">Confirm Password</Text>
                        <TextInput 
                            value={confirmPassword} 
                            onChangeText={setConfirmPassword} 
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
                        onPress={handleRegister}
                        className="bg-black rounded-xl py-5 items-center mb-4"
                    >
                        <Text className="text-white text-base font-semibold">Create Account</Text>
                    </TouchableOpacity>

                    <View className="h-8" />
                </View>
            </ScrollView>
        </>
    );
}