import { View, Text, ScrollView, TextInput, TouchableOpacity } from "react-native";
import { useState } from "react";
import { Stack, router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "../../../context/AuthContext";
import Input from "../../../components/Input";
import Button from "../../../components/Button";
import { validateDriverLogin } from "../../../services/authService";

type FieldErrors = {
  email: string;
  password: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginDriverScreen() {
  const { loginAsDriver, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isCheckingCredentials, setIsCheckingCredentials] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({
    email: "",
    password: "",
  });

  const showSuccessTransition = async (targetRoute: string) => {
    router.replace({
      pathname: "/splash",
      params: { target: targetRoute, mode: "transition" },
    });
  };

  const inputBorder = (field: keyof FieldErrors) =>
    errors[field] ? "border-red-400" : "border-gray-200";

  const ErrorText = ({ field }: { field: keyof FieldErrors }) =>
    errors[field] ? (
      <Text className='text-red-500 text-xs mt-1 ml-1'>{errors[field]}</Text>
    ) : null;

  const mapLoginErrorToFields = (message: string): FieldErrors => {
    const normalizedMessage = message.trim().toLowerCase();

    if (normalizedMessage.includes("email format")) {
      return {
        email: "Invalid email format.",
        password: "",
      };
    }

    if (normalizedMessage.includes("not found")) {
      return {
        email: "Email doesn't exist.",
        password: "",
      };
    }

    if (normalizedMessage.includes("invalid password") || normalizedMessage.includes("wrong password")) {
      return {
        email: "",
        password: "Wrong password.",
      };
    }

    return {
      email: "",
      password: message,
    };
  };

  const handleCredentialFailure = (message: string) => {
    setErrors(mapLoginErrorToFields(message));
  };

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const newErrors: FieldErrors = {
      email: "",
      password: "",
    };

    if (!normalizedEmail) {
      newErrors.email = "Email is required.";
    } else if (!EMAIL_REGEX.test(normalizedEmail)) {
      newErrors.email = "Invalid email format.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    }

    setErrors(newErrors);

    if (Object.values(newErrors).some((error) => error !== "")) {
      return;
    }

    setIsCheckingCredentials(true);

    try {
      await validateDriverLogin({
        email: normalizedEmail,
        password,
      });
    } catch (error: any) {
      setIsCheckingCredentials(false);
      handleCredentialFailure(
        error.response?.data?.message || error.message || "Login failed",
      );
      return;
    }

    setIsCheckingCredentials(false);

    const result = await loginAsDriver(normalizedEmail, password);

    if (result.success) {
      await showSuccessTransition("/(driverTabs)/DriverHomeScreen");
    } else {
      handleCredentialFailure(result.message);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Sign In" }} />
      <ScrollView className='flex-1 bg-white'>
        <View className='px-6 py-8'>
          {/* Header */}
          <View className='mb-10'>
            <Text className='text-3xl font-bold text-black mb-2'>
              Sign In as Driver
            </Text>
            <Text className='text-gray-500'>
              Enter your email and password
            </Text>
          </View>

          {/* Form Fields */}
          <Input
            label='Email'
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setErrors((prev) => ({ ...prev, email: "" }));
            }}
            placeholder='email@email.com'
            keyboardType='email-address'
            error={errors.email}
            style={{ marginBottom: 16 }}
          />

          <View style={{ marginBottom: 16 }}>
            <Text className='text-sm font-medium text-black mb-2'>
              Password
            </Text>
            <View className={`flex-row items-center bg-gray-50 border ${inputBorder("password")} rounded-xl px-4`}>
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrors((prev) => ({ ...prev, password: "" }));
                }}
                placeholder='********'
                secureTextEntry={!showPassword}
                className='flex-1 py-4 text-base text-black'
                placeholderTextColor='#9CA3AF'
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons
                  name={showPassword ? "visibility" : "visibility-off"}
                  size={22}
                  color='#9CA3AF'
                />
              </TouchableOpacity>
            </View>
            <ErrorText field='password' />
          </View>

          {/* Submit Button */}
          <Button
            title='Sign In'
            onPress={handleLogin}
            variant='primary'
            loading={loading || isCheckingCredentials}
            style={{ marginBottom: 16 }}
          />

          {/* Register Link */}
          <View className='flex-row justify-center'>
            <Text className='text-gray-600'>Don't have an account? </Text>
            <Text
              onPress={() => router.push("./RegisterDriverScreen")}
              className='text-black font-semibold'>
              Sign Up
            </Text>
          </View>

          <View className='h-8' />
        </View>
      </ScrollView>
    </>
  );
}
