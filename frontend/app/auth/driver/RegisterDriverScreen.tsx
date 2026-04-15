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
import api from "../../../services/api";
import ProgressSteps from "../../../components/ProgressSteps";

const validatePassword = (password: string) => {
  if (password.length < 8)
    return "Password must be at least 8 characters long.";
  if (!/[A-Z]/.test(password))
    return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(password))
    return "Password must contain at least one lowercase letter.";
  if (!/[0-9]/.test(password))
    return "Password must contain at least one digit.";
  if (!/[!@#$%^&*]/.test(password))
    return "Password must contain at least one special character (!@#$%^&*).";
  return null;
};

type FieldErrors = {
  firstName: string;
  familyName: string;
  age: string;
  sexe: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  consent: string;
};

const emptyErrors = (): FieldErrors => ({
  firstName: "",
  familyName: "",
  age: "",
  sexe: "",
  email: "",
  phoneNumber: "",
  password: "",
  confirmPassword: "",
  consent: "",
});

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>(emptyErrors());

  const clearError = (field: keyof FieldErrors) =>
    setErrors((p) => ({ ...p, [field]: "" }));

  const border = (field: keyof FieldErrors) =>
    errors[field] ? "border-red-400" : "border-gray-200";

  const ErrorText = ({ field }: { field: keyof FieldErrors }) =>
    errors[field] ? (
      <Text className="text-red-500 text-xs mt-1 ml-1">{errors[field]}</Text>
    ) : null;

  const handleNext = async () => {
    const newErrors = emptyErrors();

    // First name — letters only
    if (!firstName.trim()) {
      newErrors.firstName = "First name is required.";
    } else if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(firstName.trim())) {
      newErrors.firstName = "First name must contain letters only.";
    } else if (firstName.trim().length < 3) {
      newErrors.firstName = "First name must be at least 3 characters.";
    }

    // Family name — letters only
    if (!familyName.trim()) {
      newErrors.familyName = "Family name is required.";
    } else if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(familyName.trim())) {
      newErrors.familyName = "Family name must contain letters only.";
    } else if (familyName.trim().length < 3) {
      newErrors.familyName = "Family name must be at least 3 characters.";
    }

    // Age
    if (!age.trim()) {
      newErrors.age = "Age is required.";
    } else if (parseInt(age) < 17) {
      newErrors.age = "You must be at least 17 years old to register.";
    }

    // Gender
    if (!sexe.trim()) {
      newErrors.sexe = "Gender is required.";
    } else if (!["male", "female"].includes(sexe.trim().toLowerCase())) {
      newErrors.sexe = 'Gender must be "Male" or "Female".';
    }

    // Email
    if (!email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Invalid email format.";
    }

    // Phone — 10 digits, starts with 05/06/07
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required.";
    } else if (!/^(05|06|07)\d{8}$/.test(phoneNumber.replace(/\s+/g, ""))) {
      newErrors.phoneNumber =
        "Phone must be 10 digits and start with 05, 06, or 07.";
    }

    // Password
    if (!password) {
      newErrors.password = "Password is required.";
    } else {
      const passwordError = validatePassword(password);
      if (passwordError) newErrors.password = passwordError;
    }

    // Confirm password
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    // Consent
    if (!consentAccepted) {
      newErrors.consent =
        "Please accept the storage of your personal information.";
    }

    setErrors(newErrors);
    if (Object.values(newErrors).some((e) => e !== "")) return;

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

    // 1. Vérifie l'email
    try {
      await api.post("/auth/check-email", {
        email: email.trim().toLowerCase(),
      });
    } catch (err: any) {
      setErrors((p) => ({
        ...p,
        email:
          err.response?.data?.message || "Could not verify email. Try again.",
      }));
      return;
    }

    // 2. Sauvegarde et navigation
    try {
      await AsyncStorage.setItem(
        "tempRegistrationData",
        JSON.stringify(registrationData),
      );
      router.push("./LicenseUploadScreen");
    } catch (err) {
      setErrors((p) => ({
        ...p,
        consent: "Failed to save data. Please try again.",
      }));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Create Account" }} />
      <ProgressSteps currentStep={1} />
      <ScrollView className="flex-1 bg-white">
        <View className="px-6 py-8">
          <View className="mb-10">
            <Text className="text-2xl font-bold text-black mb-2">
              Register as Driver
            </Text>
            <Text className="text-gray-500">
              Fill in your details to get started
            </Text>
          </View>

          {/* First Name */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">
              First Name
            </Text>
            <TextInput
              value={firstName}
              onChangeText={(v) => {
                setFirstName(v);
                clearError("firstName");
              }}
              placeholder="First name"
              className={`bg-gray-50 border ${border("firstName")} rounded-xl px-4 py-4 text-base`}
              placeholderTextColor="#9CA3AF"
            />
            <ErrorText field="firstName" />
          </View>

          {/* Family Name */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">
              Family Name
            </Text>
            <TextInput
              value={familyName}
              onChangeText={(v) => {
                setFamilyName(v);
                clearError("familyName");
              }}
              placeholder="Family name"
              className={`bg-gray-50 border ${border("familyName")} rounded-xl px-4 py-4 text-base`}
              placeholderTextColor="#9CA3AF"
            />
            <ErrorText field="familyName" />
          </View>

          {/* Age */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">Age</Text>
            <TextInput
              value={age}
              onChangeText={(v) => {
                setAge(v);
                clearError("age");
              }}
              placeholder="25"
              keyboardType="numeric"
              className={`bg-gray-50 border ${border("age")} rounded-xl px-4 py-4 text-base`}
              placeholderTextColor="#9CA3AF"
            />
            <ErrorText field="age" />
          </View>

          {/* Gender */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">Gender</Text>
            <TextInput
              value={sexe}
              onChangeText={(v) => {
                setSexe(v);
                clearError("sexe");
              }}
              placeholder="Male / Female"
              className={`bg-gray-50 border ${border("sexe")} rounded-xl px-4 py-4 text-base`}
              placeholderTextColor="#9CA3AF"
            />
            <ErrorText field="sexe" />
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">Email</Text>
            <TextInput
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                clearError("email");
              }}
              placeholder="email@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              className={`bg-gray-50 border ${border("email")} rounded-xl px-4 py-4 text-base`}
              placeholderTextColor="#9CA3AF"
            />
            <ErrorText field="email" />
          </View>

          {/* Phone Number */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">
              Phone Number
            </Text>
            <TextInput
              value={phoneNumber}
              onChangeText={(v) => {
                setPhoneNumber(v);
                clearError("phoneNumber");
              }}
              placeholder="+213 XXX XXX XXX"
              keyboardType="phone-pad"
              className={`bg-gray-50 border ${border("phoneNumber")} rounded-xl px-4 py-4 text-base`}
              placeholderTextColor="#9CA3AF"
            />
            <ErrorText field="phoneNumber" />
          </View>

          {/* Password */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">
              Password
            </Text>
            <View
              className={`flex-row items-center bg-gray-50 border ${border("password")} rounded-xl px-4`}>
              <TextInput
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  clearError("password");
                }}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                className="flex-1 py-4 text-base"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons
                  name={showPassword ? "visibility" : "visibility-off"}
                  size={22}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>
            <ErrorText field="password" />
          </View>

          {/* Confirm Password */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-black mb-2">
              Confirm Password
            </Text>
            <View
              className={`flex-row items-center bg-gray-50 border ${border("confirmPassword")} rounded-xl px-4`}>
              <TextInput
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  clearError("confirmPassword");
                }}
                placeholder="••••••••"
                secureTextEntry={!showConfirmPassword}
                className="flex-1 py-4 text-base"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <MaterialIcons
                  name={showConfirmPassword ? "visibility" : "visibility-off"}
                  size={22}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>
            <ErrorText field="confirmPassword" />
          </View>

          {/* Privacy & Consent Section */}
          <View className="bg-gray-50 rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="security" size={20} color="#000" />
              <Text className="text-sm font-semibold text-black ml-2">
                Privacy & Data Storage
              </Text>
            </View>
            <Text className="text-xs text-gray-600">
              Identity verification helps us ensure a safe experience during the
              trip. Your information is locked and secure.
            </Text>
          </View>

          {/* Consent Checkbox */}
          <TouchableOpacity
            onPress={() => {
              setConsentAccepted(!consentAccepted);
              clearError("consent");
            }}
            className="flex-row items-start mb-2">
            <View
              className={`w-6 h-6 rounded-md border-2 justify-center items-center mt-0.5 ${
                consentAccepted
                  ? "bg-black border-black"
                  : errors.consent
                    ? "border-red-400"
                    : "border-gray-400"
              }`}>
              {consentAccepted && (
                <MaterialIcons name="check" size={18} color="#FFF" />
              )}
            </View>
            <Text className="flex-1 text-sm text-gray-800 ml-3 leading-5">
              I accept the protection measures for my personal data.
            </Text>
          </TouchableOpacity>
          {errors.consent ? (
            <Text className="text-red-500 text-xs mb-4 ml-1">
              {errors.consent}
            </Text>
          ) : (
            <View className="mb-4" />
          )}

          {/* Next Button */}
          <TouchableOpacity
            onPress={handleNext}
            className="rounded-xl py-5 items-center mb-4 bg-black">
            <Text className="text-white text-base font-semibold">Next</Text>
          </TouchableOpacity>

          {/* Login Link */}
          <View className="flex-row justify-center">
            <Text className="text-gray-600">Already have an account? </Text>
            <TouchableOpacity
              onPress={() => router.push("./LoginDriverScreen")}>
              <Text className="text-black font-semibold">Sign In</Text>
            </TouchableOpacity>
          </View>

          <View className="h-8" />
        </View>
      </ScrollView>
    </>
  );
}
