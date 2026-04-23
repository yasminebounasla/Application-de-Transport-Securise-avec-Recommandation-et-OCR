import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';
import CountryCodePicker from '../../../components/CountryCodePicker';
import PasswordValidation from '../../../components/PasswordValidation';
import {
  ALLOWED_PASSWORD_SYMBOLS,
  hasUnsupportedPasswordSymbol,
} from '../../../utils/passwordValidation';
import {
  buildInternationalPhoneNumber,
  DEFAULT_COUNTRY_PHONE,
  getCountryPhoneOption,
  normalizeLocalPhoneNumber,
  validatePhoneNumberForCountry,
} from '../../../utils/phoneNumber';

const validatePassword = (password: string) => {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one digit.';
  if (hasUnsupportedPasswordSymbol(password)) {
    return `Password symbols must be one of these: ${ALLOWED_PASSWORD_SYMBOLS}`;
  }
  if (!/[!@#$%&*§]/.test(password)) {
    return `Password must contain at least one symbol from: ${ALLOWED_PASSWORD_SYMBOLS}`;
  }
  return null;
};

const AGE_INPUT_REGEX = /^$|^\d$|^\d\d$/;

type FieldErrors = {
  firstName: string;
  familyName: string;
  age: string;
  sexe: string;
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
  const [sexe, setSexe] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_COUNTRY_PHONE.code);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({
    firstName: '',
    familyName: '',
    age: '',
    sexe: '',
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
    const selectedCountry = getCountryPhoneOption(phoneCountryCode);
    const newErrors: FieldErrors = {
      firstName: '',
      familyName: '',
      age: '',
      sexe: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
    };

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required.';
    } else if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(firstName.trim())) {
      newErrors.firstName = 'First name must contain letters only.';
    } else if (firstName.trim().length < 3) {
      newErrors.firstName = 'First name must be at least 3 characters.';
    }

    if (!familyName.trim()) {
      newErrors.familyName = 'Family name is required.';
    } else if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(familyName.trim())) {
      newErrors.familyName = 'Family name must contain letters only.';
    } else if (familyName.trim().length < 3) {
      newErrors.familyName = 'Family name must be at least 3 characters.';
    }

    if (!age.trim()) {
      newErrors.age = 'Age is required.';
    } else if (parseInt(age, 10) < 18) {
      newErrors.age = 'You must be at least 18 years old to register.';
    } else if (parseInt(age, 10) > 100) {
      newErrors.age = 'Age must be 100 or less.';
    }

    if (!sexe.trim()) {
      newErrors.sexe = 'Gender is required.';
    } else if (!['male', 'female'].includes(sexe.trim().toLowerCase())) {
      newErrors.sexe = 'Gender must be "Male" or "Female".';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format.';
    } else {
      try {
        await api.post('/auth/check-email', {
          email: email.trim().toLowerCase(),
        });
      } catch (err: any) {
        if (err.response?.status === 409) {
          newErrors.email =
            err.response?.data?.message || 'This email is already in use.';
        }
      }
    }

    newErrors.phoneNumber = validatePhoneNumberForCountry(phoneNumber, selectedCountry);

    if (!newErrors.phoneNumber) {
      try {
        await api.post('/auth/check-phone', {
          phoneNumber: buildInternationalPhoneNumber(phoneNumber, selectedCountry),
          role: 'passenger',
        });
      } catch (err: any) {
        if (err.response?.status === 409) {
          newErrors.phoneNumber =
            err.response?.data?.message || 'This phone number is already in use.';
        }
      }
    }

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
      sexe,
      phoneNumber,
      phoneCountryCode,
    });

    if (result.success) {
      router.replace('./../../../(passengerTabs)/PassengerHomeScreen');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Sign Up' }} />
      <ScrollView className="flex-1 bg-white">
        <View className="px-6 py-8">
          <View className="mb-10">
            <Text className="text-3xl font-bold text-black mb-2">Sign Up as Passenger</Text>
            <Text className="text-gray-500">Fill in your details to get started</Text>
          </View>

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

          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">Age</Text>
            <TextInput
              value={age}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, '');
                if (AGE_INPUT_REGEX.test(digits)) {
                  setAge(digits);
                  setErrors((p) => ({ ...p, age: '' }));
                }
              }}
              placeholder="25"
              keyboardType="numeric"
              maxLength={2}
              className={`bg-gray-50 border ${inputBorder('age')} rounded-xl px-4 py-4 text-base`}
              placeholderTextColor="#9CA3AF"
            />
            <ErrorText field="age" />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">Gender</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {['Male', 'Female'].map((option) => {
                const isSelected = sexe === option;
                return (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSexe(option);
                      setErrors((p) => ({ ...p, sexe: '' }));
                    }}
                    style={{
                      flex: 1,
                      height: 56,
                      borderRadius: 16,
                      borderWidth: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelected ? '#111111' : '#F9FAFB',
                      borderColor: errors.sexe
                        ? '#F87171'
                        : isSelected
                          ? '#111111'
                          : '#E5E7EB',
                    }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: isSelected ? '#FFFFFF' : '#111827',
                      }}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <ErrorText field="sexe" />
          </View>

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

          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">Phone Number</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }}>
              <View style={{ marginRight: 12 }}>
                <CountryCodePicker
                  value={phoneCountryCode}
                  onChange={(code) => {
                    setPhoneCountryCode(code);
                    setPhoneNumber((current) =>
                      normalizeLocalPhoneNumber(current, getCountryPhoneOption(code)),
                    );
                    setErrors((p) => ({ ...p, phoneNumber: '' }));
                  }}
                  hasError={!!errors.phoneNumber}
                />
              </View>
              <TextInput
                value={phoneNumber}
                onChangeText={(v) => {
                  setPhoneNumber(normalizeLocalPhoneNumber(v, getCountryPhoneOption(phoneCountryCode)));
                  setErrors((p) => ({ ...p, phoneNumber: '' }));
                }}
                placeholder={getCountryPhoneOption(phoneCountryCode).placeholder}
                keyboardType="phone-pad"
                className={`flex-1 bg-gray-50 border ${inputBorder('phoneNumber')} rounded-xl px-4 py-4 text-base`}
                placeholderTextColor="#9CA3AF"
                style={{ flex: 1, minWidth: 0 }}
              />
            </View>
            <ErrorText field="phoneNumber" />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">Password</Text>
            <View className={`flex-row items-center bg-gray-50 border ${inputBorder('password')} rounded-xl px-4`}>
              <TextInput
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: '' })); }}
                placeholder="********"
                secureTextEntry={!showPassword}
                className="flex-1 py-4 text-base"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <ErrorText field="password" />
            <PasswordValidation password={password} />
          </View>

          <View className="mb-8">
            <Text className="text-sm font-medium text-black mb-2">Confirm Password</Text>
            <View className={`flex-row items-center bg-gray-50 border ${inputBorder('confirmPassword')} rounded-xl px-4`}>
              <TextInput
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setErrors((p) => ({ ...p, confirmPassword: '' })); }}
                placeholder="********"
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

          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            className={`rounded-xl py-5 items-center mb-4 ${loading ? 'bg-gray-400' : 'bg-black'}`}>
            <Text className="text-white text-base font-semibold">
              {loading ? 'Signing up...' : 'Sign Up'}
            </Text>
          </TouchableOpacity>

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
