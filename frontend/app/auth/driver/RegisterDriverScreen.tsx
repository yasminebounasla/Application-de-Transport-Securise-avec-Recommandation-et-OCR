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
import CountryCodePicker from "../../../components/CountryCodePicker";
import {
  getPasswordNeedsMessage,
} from "../../../utils/passwordValidation";
import {
  buildInternationalPhoneNumber,
  DEFAULT_COUNTRY_PHONE,
  getCountryPhoneOption,
  normalizeLocalPhoneNumber,
  validatePhoneNumberForCountry,
} from "../../../utils/phoneNumber";

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
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_COUNTRY_PHONE.code);
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
    const selectedCountry = getCountryPhoneOption(phoneCountryCode);

    if (!firstName.trim()) {
      newErrors.firstName = "First name is required.";
    } else if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(firstName.trim())) {
      newErrors.firstName = "First name must contain letters only.";
    } else if (firstName.trim().length < 3) {
      newErrors.firstName = "First name must be at least 3 characters.";
    }

    if (!familyName.trim()) {
      newErrors.familyName = "Family name is required.";
    } else if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(familyName.trim())) {
      newErrors.familyName = "Family name must contain letters only.";
    } else if (familyName.trim().length < 3) {
      newErrors.familyName = "Family name must be at least 3 characters.";
    }

    if (!age.trim()) {
      newErrors.age = "Age is required.";
    } else if (parseInt(age, 10) < 18) {
      newErrors.age = "You must be at least 18 years old to register.";
    } else if (parseInt(age, 10) > 100) {
      newErrors.age = "Age must be 100 or less.";
    }

    if (!sexe.trim()) {
      newErrors.sexe = "Gender is required.";
    } else if (!["male", "female"].includes(sexe.trim().toLowerCase())) {
      newErrors.sexe = 'Gender must be "Male" or "Female".';
    }

    if (!email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Invalid email format.";
    } else {
      // Check if email already exists
      try {
        const response = await api.post("/auth/check-email", {
          email: email.trim().toLowerCase(),
        });
        console.log('Email check SUCCESS:', response.status, response.data);
      } catch (err: any) {
        console.log('=== EMAIL CHECK ERROR ===');
        console.log('Error name:', err.name);
        console.log('Error code:', err.code);
        console.log('Error message:', err.message);
        console.log('Has response?', !!err.response);
        console.log('Full error:', JSON.stringify(err, null, 2));
        
        if (err.response?.status === 409) {
          newErrors.email =
            err.response?.data?.message || "This email is already registered. Please use a different email.";
        }
      }
    }

    newErrors.phoneNumber = validatePhoneNumberForCountry(phoneNumber, selectedCountry);

    if (!newErrors.phoneNumber) {
      try {
        await api.post("/auth/check-phone", {
          phoneNumber: buildInternationalPhoneNumber(phoneNumber, selectedCountry),
          role: "driver",
        });
      } catch (err: any) {
        if (err.response?.status === 409) {
          newErrors.phoneNumber =
            err.response?.data?.message || "This phone number is already in use.";
        }
      }
    }

    if (!password) {
      newErrors.password = "Password is required.";
    } else {
      const passwordNeeds = getPasswordNeedsMessage(password);
      if (passwordNeeds) newErrors.password = passwordNeeds;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

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
      phoneCountryCode,
      consentAccepted,
    };

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
      <Stack.Screen options={{ title: "Sign Up" }} />
      <ProgressSteps currentStep={1} />
      <ScrollView className="flex-1 bg-white">
        <View className="px-6 py-8">
          <View className="mb-10">
            <Text className="text-2xl font-bold text-black mb-2">
              Sign Up as Driver
            </Text>
            <Text className="text-gray-500">
              Fill in your details to get started
            </Text>
          </View>

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

          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">Age</Text>
            <TextInput
              value={age}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, "");
                if (AGE_INPUT_REGEX.test(digits)) {
                  setAge(digits);
                  clearError("age");
                }
              }}
              placeholder="25"
              keyboardType="numeric"
              maxLength={2}
              className={`bg-gray-50 border ${border("age")} rounded-xl px-4 py-4 text-base`}
              placeholderTextColor="#9CA3AF"
            />
            <ErrorText field="age" />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">Gender</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {["Male", "Female"].map((option) => {
                const isSelected = sexe === option;
                return (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSexe(option);
                      clearError("sexe");
                    }}
                    style={{
                      flex: 1,
                      height: 56,
                      borderRadius: 16,
                      borderWidth: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isSelected ? "#111111" : "#F9FAFB",
                      borderColor: errors.sexe
                        ? "#F87171"
                        : isSelected
                          ? "#111111"
                          : "#E5E7EB",
                    }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: isSelected ? "#FFFFFF" : "#111827",
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

          <View className="mb-4">
            <Text className="text-sm font-medium text-black mb-2">
              Phone Number
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "nowrap" }}>
              <View style={{ marginRight: 12 }}>
                <CountryCodePicker
                  value={phoneCountryCode}
                  onChange={(code) => {
                    setPhoneCountryCode(code);
                    setPhoneNumber((current) =>
                      normalizeLocalPhoneNumber(current, getCountryPhoneOption(code)),
                    );
                    clearError("phoneNumber");
                  }}
                  hasError={!!errors.phoneNumber}
                />
              </View>
              <TextInput
                value={phoneNumber}
                onChangeText={(v) => {
                  setPhoneNumber(
                    normalizeLocalPhoneNumber(v, getCountryPhoneOption(phoneCountryCode)),
                  );
                  clearError("phoneNumber");
                }}
                placeholder={getCountryPhoneOption(phoneCountryCode).placeholder}
                keyboardType="phone-pad"
                className={`flex-1 bg-gray-50 border ${border("phoneNumber")} rounded-xl px-4 py-4 text-base`}
                placeholderTextColor="#9CA3AF"
                style={{ flex: 1, minWidth: 0 }}
              />
            </View>
            <ErrorText field="phoneNumber" />
          </View>

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
                  setErrors((p) => ({
                    ...p,
                    password: v ? getPasswordNeedsMessage(v) ?? "" : "",
                  }));
                }}
                placeholder="********"
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
                placeholder="********"
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

          <TouchableOpacity
            onPress={handleNext}
            className="rounded-xl py-5 items-center mb-4 bg-black">
            <Text className="text-white text-base font-semibold">Next</Text>
          </TouchableOpacity>

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
