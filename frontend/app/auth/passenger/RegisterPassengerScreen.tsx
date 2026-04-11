import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

const validatePassword = (password: string) => {
  if (password.length < 8) return "Password must be at least 8 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one digit.";
  if (!/[!@#$%^&*]/.test(password)) return "Password must contain at least one special character (!@#$%^&*).";
  return null;
};

type FieldErrors = {
  firstName: string;
  familyName: string;
  age: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
};

export default function RegisterPassengerScreen() {
  const { registerAsPassenger, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [age, setAge] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({
    firstName: '',
    familyName: '',
    age: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });

  const inputBorder = (field: keyof FieldErrors) =>
    errors[field] ? 'border-red-400' : 'border-gray-200';

  const ErrorText = ({ field }: { field: keyof FieldErrors }) =>
    errors[field] ? (
      <Text className="text-red-500 text-xs mt-1 ml-1">{errors[field]}</Text>
    ) : null;

  const handleRegister = async () => {
    const newErrors: FieldErrors = {
      firstName: '',
      familyName: '',
      age: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
    };

    if (!firstName.trim()) newErrors.firstName = 'First name is required.';
    if (!familyName.trim()) newErrors.familyName = 'Family name is required.';

    if (!age.trim()) {
      newErrors.age = 'Age is required.';
    } else if (parseInt(age) < 17) {
      newErrors.age = 'You must be at least 17 years old to register.';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format.';
    }

    if (!phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required.';

    if (!password) {
      newErrors.password = 'Password is required.';
    } else {
      const passwordError = validatePassword(password);
      if (passwordError) newErrors.password = passwordError;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(newErrors);
    if (Object.values(newErrors).some((e) => e !== '')) return;

    const result = await registerAsPassenger({
      email,
      password,
      confirmPassword,
      firstName,
      familyName,
      age,
      phoneNumber,
    });

    if (result.success) {
      Alert.alert('Success!', 'Your account has been created successfully', [
        { text: 'OK', onPress: () => router.replace('./../../../passenger/HomeScreen') },
      ]);
    } else {
      setErrors((prev) => ({ ...prev, email: result.message }));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Create Account' }} />
      <ScrollView className="flex-1 bg-white">
        <View className="px-6 py-8">
          {/* Header */}
          <View className="mb-10">
            <Text className="text-3xl font-bold text-black mb-2">Register as Passenger</Text>
            <Text className="text-gray-500">Fill in your details to get started</Text>
          </View>

          {/* First Name */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">First Name</Text>
            <TextInput
              value={firstName}
              onChangeText={(v) => { setFirstName(v); setErrors((p) => ({ ...p, firstName: '' })); }}
              placeholder="First name"
              className={`bg-gray-50 border ${inputBorder('firstName')} rounded-xl px-4 py-4 text-base`}
              placeholderTextColor="#9CA3AF"
            />
            <ErrorText field="firstName" />
          </View>

          {/* Family Name */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">Family Name</Text>
            <TextInput
              value={familyName}
              onChangeText={(v) => { setFamilyName(v); setErrors((p) => ({ ...p, familyName: '' })); }}
              placeholder="Family name"
              className={`bg-gray-50 border ${inputBorder('familyName')} rounded-xl px-4 py-4 text-base`}
              placeholderTextColor="#9CA3AF"
            />
            <ErrorText field="familyName" />
          </View>

          {/* Age */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">Age</Text>
            <TextInput
              value={age}
              onChangeText={(v) => { setAge(v); setErrors((p) => ({ ...p, age: '' })); }}
              placeholder="25"
              keyboardType="numeric"
              className={`bg-gray-50 border ${inputBorder('age')} rounded-xl px-4 py-4 text-base`}
              placeholderTextColor="#9CA3AF"
            />
            <ErrorText field="age" />
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">Email</Text>
            <TextInput
              value={email}
              onChangeText={(v) => { setEmail(v); setErrors((p) => ({ ...p, email: '' })); }}
              placeholder="email@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              className={`bg-gray-50 border ${inputBorder('email')} rounded-xl px-4 py-4 text-base`}
              placeholderTextColor="#9CA3AF"
            />
            <ErrorText field="email" />
          </View>

          {/* Phone Number */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">Phone Number</Text>
            <TextInput
              value={phoneNumber}
              onChangeText={(v) => { setPhoneNumber(v); setErrors((p) => ({ ...p, phoneNumber: '' })); }}
              placeholder="+213 XXX XXX XXX"
              keyboardType="phone-pad"
              className={`bg-gray-50 border ${inputBorder('phoneNumber')} rounded-xl px-4 py-4 text-base`}
              placeholderTextColor="#9CA3AF"
            />
            <ErrorText field="phoneNumber" />
          </View>

          {/* Password */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">Password</Text>
            <View className={`flex-row items-center bg-gray-50 border ${inputBorder('password')} rounded-xl px-4`}>
              <TextInput
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: '' })); }}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                className="flex-1 py-4 text-base"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <ErrorText field="password" />
          </View>

          {/* Confirm Password */}
          <View className="mb-8">
            <Text className="text-sm font-medium text-black mb-2">Confirm Password</Text>
            <View className={`flex-row items-center bg-gray-50 border ${inputBorder('confirmPassword')} rounded-xl px-4`}>
              <TextInput
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setErrors((p) => ({ ...p, confirmPassword: '' })); }}
                placeholder="••••••••"
                secureTextEntry={!showConfirmPassword}
                className="flex-1 py-4 text-base"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <MaterialIcons name={showConfirmPassword ? 'visibility' : 'visibility-off'} size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <ErrorText field="confirmPassword" />
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            className={`rounded-xl py-5 items-center mb-4 ${loading ? 'bg-gray-400' : 'bg-black'}`}>
            <Text className="text-white text-base font-semibold">
              {loading ? 'Creating account...' : 'Create Account'}
            </Text>
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
