import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useState } from 'react';
import { Stack } from 'expo-router';
import { registerDriver } from '../../services/authService';

export default function RegisterDriverScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [familyName, setFamilyName] = useState('');
    const [age, setAge] = useState('');
    const [sexe, setSexe] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [error, setError] = useState('');

    const handleRegister = async () => {
        try {
            const data = await registerDriver({
                email,
                password,
                confirmPassword,
                firstName,
                familyName,
                age,
                sexe,
                phoneNumber
            });
            console.log('Registration successful:', data);
        } catch (error: any) {
            setError(
                error.response?.data?.message || 'Something went wrong'
            );
        }
    }

    return (
        <>
            <Stack.Screen options={{ title: 'Register as Driver'}} />
            <ScrollView className="flex-1 bg-gray-50">
                <View className="px-6 py-8">
                    {/* Header */}
                    <View className="mb-8">
                        <Text className="text-3xl font-bold text-gray-800 mb-2">Create Account</Text>
                        <Text className="text-gray-600">Fill in your details to get started</Text>
                    </View>

                    {/* Personal Info Section */}
                    <View className="mb-6">
                        <Text className="text-sm font-semibold text-gray-700 mb-3">Personal Information</Text>
                        
                        <View className="mb-4">
                            <Text className="text-sm text-gray-700 mb-1.5">First Name</Text>
                            <TextInput 
                                value={firstName} 
                                onChangeText={setFirstName} 
                                placeholder='Enter your first name' 
                                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-base"
                            />
                        </View>

                        <View className="mb-4">
                            <Text className="text-sm text-gray-700 mb-1.5">Family Name</Text>
                            <TextInput 
                                value={familyName} 
                                onChangeText={setFamilyName} 
                                placeholder='Enter your family name' 
                                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-base"
                            />
                        </View>

                        <View className="mb-4">
                            <Text className="text-sm text-gray-700 mb-1.5">Age</Text>
                            <TextInput 
                                value={age} 
                                onChangeText={setAge} 
                                placeholder='Enter your age' 
                                keyboardType='numeric' 
                                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-base"
                            />
                        </View>

                        <View className="mb-4">
                            <Text className="text-sm text-gray-700 mb-1.5">Gender</Text>
                            <TextInput 
                                value={sexe} 
                                onChangeText={setSexe} 
                                placeholder='Enter your gender' 
                                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-base"
                            />
                        </View>
                    </View>

                    {/* Contact Section */}
                    <View className="mb-6">
                        <Text className="text-sm font-semibold text-gray-700 mb-3">Contact Details</Text>
                        
                        <View className="mb-4">
                            <Text className="text-sm text-gray-700 mb-1.5">Email</Text>
                            <TextInput 
                                value={email} 
                                onChangeText={setEmail} 
                                placeholder='example@email.com' 
                                keyboardType='email-address'
                                autoCapitalize='none'
                                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-base"
                            />
                        </View>

                        <View className="mb-4">
                            <Text className="text-sm text-gray-700 mb-1.5">Phone Number</Text>
                            <TextInput 
                                value={phoneNumber} 
                                onChangeText={setPhoneNumber} 
                                placeholder='+213 XXX XXX XXX' 
                                keyboardType='phone-pad' 
                                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-base"
                            />
                        </View>
                    </View>

                    {/* Security Section */}
                    <View className="mb-6">
                        <Text className="text-sm font-semibold text-gray-700 mb-3">Security</Text>
                        
                        <View className="mb-4">
                            <Text className="text-sm text-gray-700 mb-1.5">Password</Text>
                            <TextInput 
                                value={password} 
                                onChangeText={setPassword} 
                                placeholder='Enter your password' 
                                secureTextEntry 
                                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-base"
                            />
                        </View>

                        <View className="mb-4">
                            <Text className="text-sm text-gray-700 mb-1.5">Confirm Password</Text>
                            <TextInput 
                                value={confirmPassword} 
                                onChangeText={setConfirmPassword} 
                                placeholder='Re-enter your password' 
                                secureTextEntry 
                                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-base"
                            />
                        </View>
                    </View>

                    {/* Error Message */}
                    {error ? (
                        <View className="bg-red-100 border border-red-400 rounded-lg px-4 py-3 mb-6">
                            <Text className="text-red-700 text-sm">{error}</Text>
                        </View>
                    ) : null}

                    {/* Submit Button */}
                    <TouchableOpacity 
                        onPress={handleRegister}
                        className="bg-blue-600 rounded-lg py-4 items-center mb-4"
                    >
                        <Text className="text-white text-base font-semibold">Next</Text>
                    </TouchableOpacity>

                    {/* Bottom spacing for scroll */}
                    <View className="h-8" />
                </View>
            </ScrollView>
        </>
    );
}