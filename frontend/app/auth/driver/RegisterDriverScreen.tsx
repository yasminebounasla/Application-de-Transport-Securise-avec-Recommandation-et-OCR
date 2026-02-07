import { View, Text, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import Input from '../../../components/Input';
import Button from '../../../components/Button';

export default function RegisterDriverScreen() {
    const { registerAsDriver, loading } = useAuth();
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
        setError('');

        if (!email || !password || !confirmPassword || !firstName || !familyName || !age || !sexe || !phoneNumber) {
            setError('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        const result = await registerAsDriver({
            email,
            password,
            confirmPassword,
            firstName,
            familyName,
            age,
            sexe,
            phoneNumber
        });

        if (result.success) {
            Alert.alert(
                'Success!',
                'Your account has been created successfully',
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
            <Stack.Screen options={{ title: 'Create Account'}} />
            <ScrollView className="flex-1 bg-white">
                <View className="px-6 py-8">
                    {/* Header */}
                    <View className="mb-10">
                        <Text className="text-3xl font-bold text-black mb-2">
                            Register as Driver
                        </Text>
                        <Text className="text-gray-500">
                            Fill in your details to get started
                        </Text>
                    </View>

                    {/* Form Fields */}
                    <Input
                        label="First Name"
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder="First name"
                        style={{ marginBottom: 16 }}
                    />

                    <Input
                        label="Family Name"
                        value={familyName}
                        onChangeText={setFamilyName}
                        placeholder="Family name"
                        style={{ marginBottom: 16 }}
                    />

                    <Input
                        label="Age"
                        value={age}
                        onChangeText={setAge}
                        placeholder="25"
                        keyboardType="numeric"
                        style={{ marginBottom: 16 }}
                    />

                    <Input
                        label="Gender"
                        value={sexe}
                        onChangeText={setSexe}
                        placeholder="Male/Female"
                        style={{ marginBottom: 16 }}
                    />

                    <Input
                        label="Email"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="email@email.com"
                        keyboardType="email-address"
                        style={{ marginBottom: 16 }}
                    />

                    <Input
                        label="Phone Number"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        placeholder="+213 XXX XXX XXX"
                        keyboardType="phone-pad"
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

                    <Input
                        label="Confirm Password"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
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
                        title="Create Account"
                        onPress={handleRegister}
                        variant="primary"
                        loading={loading}
                        style={{ marginBottom: 16 }}
                    />

                    {/* Login Link */}
                    <View className="flex-row justify-center">
                        <Text className="text-gray-600">Already have an account? </Text>
                        <Text 
                            onPress={() => router.push('./LoginDriverScreen')}
                            className="text-black font-semibold"
                        >
                            Sign In
                        </Text>
                    </View>

                    <View className="h-8" />
                </View>
            </ScrollView>
        </>
    );
}