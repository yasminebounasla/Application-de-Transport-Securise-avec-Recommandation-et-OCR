import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useState } from "react";
import { Stack, router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import ProgressSteps from "../../../components/ProgressSteps";

export default function RegisterDriverScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [age, setAge] = useState("");
  const [sexe, setSexe] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState("");

  const handleNext = async () => {
    setError("");

    // Validation
    if (
      !email ||
      !password ||
      !confirmPassword ||
      !firstName ||
      !familyName ||
      !age ||
      !sexe ||
      !phoneNumber
    ) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!consentAccepted) {
      setError("Please accept the storage of your personal information");
      return;
    }

    // Stocker temporairement les données pour les étapes suivantes
    const registrationData = {
      email,
      password,
      confirmPassword,
      firstName,
      familyName,
      age,
      sexe,
      phoneNumber,
      consentAccepted,
    };

    try {
      await AsyncStorage.setItem(
        "tempRegistrationData",
        JSON.stringify(registrationData),
      );
      router.push("./LicenseUploadScreen");
    } catch (err) {
      setError("Failed to save data. Please try again.");
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Create Account" }} />

      <ScrollView className='flex-1 bg-white'>
        <View className='px-6 py-8'>
          <ProgressSteps currentStep={1} />

          <View className='mb-10'>
            <Text className='text-3xl font-bold text-black mb-2'>
              Register as Driver
            </Text>
            <Text className='text-gray-500'>
              Fill in your details to get started
            </Text>
          </View>

          {/* Form Fields */}
          <View className='mb-4'>
            <Text className='text-sm font-medium text-black mb-2'>
              First Name
            </Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder='First name'
              className='bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base'
              placeholderTextColor='#9CA3AF'
            />
          </View>

          <View className='mb-4'>
            <Text className='text-sm font-medium text-black mb-2'>
              Family Name
            </Text>
            <TextInput
              value={familyName}
              onChangeText={setFamilyName}
              placeholder='Family name'
              className='bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base'
              placeholderTextColor='#9CA3AF'
            />
          </View>

          <View className='mb-4'>
            <Text className='text-sm font-medium text-black mb-2'>Age</Text>
            <TextInput
              value={age}
              onChangeText={setAge}
              placeholder='25'
              keyboardType='numeric'
              className='bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base'
              placeholderTextColor='#9CA3AF'
            />
          </View>

          <View className='mb-4'>
            <Text className='text-sm font-medium text-black mb-2'>Gender</Text>
            <TextInput
              value={sexe}
              onChangeText={setSexe}
              placeholder='Male/Female'
              className='bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base'
              placeholderTextColor='#9CA3AF'
            />
          </View>

          <View className='mb-4'>
            <Text className='text-sm font-medium text-black mb-2'>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder='email@email.com'
              keyboardType='email-address'
              autoCapitalize='none'
              className='bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base'
              placeholderTextColor='#9CA3AF'
            />
          </View>

          <View className='mb-4'>
            <Text className='text-sm font-medium text-black mb-2'>
              Phone Number
            </Text>
            <TextInput
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder='+213 XXX XXX XXX'
              keyboardType='phone-pad'
              className='bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base'
              placeholderTextColor='#9CA3AF'
            />
          </View>

          <View className='mb-4'>
            <Text className='text-sm font-medium text-black mb-2'>
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder='••••••••'
              secureTextEntry
              className='bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base'
              placeholderTextColor='#9CA3AF'
            />
          </View>

          <View className='mb-6'>
            <Text className='text-sm font-medium text-black mb-2'>
              Confirm Password
            </Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder='••••••••'
              secureTextEntry
              className='bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base'
              placeholderTextColor='#9CA3AF'
            />
          </View>

          {/* Privacy & Consent Section */}
          <View className='bg-gray-50 rounded-xl p-4 mb-4'>
            <View className='flex-row items-center mb-2'>
              <MaterialIcons name='security' size={20} color='#000' />
              <Text className='text-sm font-semibold text-black ml-2'>
                Privacy & Data Storage
              </Text>
            </View>
            <Text className='text-xs text-gray-600'>
              Identity verification helps us ensure a safe experience during the trip. 
              Your information is locked and secure.
            </Text>
          </View>

          {/* Consent Checkbox */}
          <TouchableOpacity
            onPress={() => setConsentAccepted(!consentAccepted)}
            className='flex-row items-start mb-6'>
            <View
              className={`w-6 h-6 rounded-md border-2 justify-center items-center mt-0.5 ${
                consentAccepted ? "bg-black border-black" : "border-gray-400"
              }`}>
              {consentAccepted && (
                <MaterialIcons name='check' size={18} color='#FFF' />
              )}
            </View>
            <Text className='flex-1 text-sm text-gray-800 ml-3 leading-5'>
              I accept the protection measures for my personal data.
            </Text>
          </TouchableOpacity>

          {/* Error Message */}
          {error ? (
            <View className='bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6'>
              <Text className='text-red-600 text-sm'>{error}</Text>
            </View>
          ) : null}

          {/* Next Button */}
          <TouchableOpacity
            onPress={handleNext}
            className='rounded-xl py-5 items-center mb-4 bg-black'>
            <Text className='text-white text-base font-semibold'>Next</Text>
          </TouchableOpacity>

          {/* Login Link */}
          <View className='flex-row justify-center'>
            <Text className='text-gray-600'>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => router.push("./LoginDriverScreen")}>
              <Text className='text-black font-semibold'>Sign In</Text>
            </TouchableOpacity>
          </View>

          <View className='h-8' />
        </View>
      </ScrollView>
    </>
  );
}