import { View, Text, ScrollView } from "react-native";
import { useState } from "react";
import { Stack, router } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import Input from "../../../components/Input";
import Button from "../../../components/Button";

export default function LoginDriverScreen() {
  const { loginAsDriver, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleLogin = async () => {
    setErrors({});

    const newErrors: { email?: string; password?: string } = {};

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const result = await loginAsDriver(email, password);

    if (result.success) {
      router.replace("./../../../(driverTabs)/DriverHomeScreen");
    } else {
      // mauvais mail ou password → border rouge sur les deux
      setErrors({
        email: "Invalid email or password",
        password: "Invalid email or password",
      });
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Sign In" }} />
      <ScrollView className="flex-1 bg-white">
        <View className="px-6 py-8">

          {/* Header */}
          <View className="mb-10">
            <Text className="text-3xl font-bold text-black mb-2">
              Sign In as Driver
            </Text>
            <Text className="text-gray-500">
              Enter your credentials to sign in
            </Text>
          </View>

          <Input
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
            }}
            placeholder="email@email.com"
            keyboardType="email-address"
            error={errors.email}
            style={{ marginBottom: 16 }}
          />

          <Input
            label="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
            }}
            placeholder="••••••••"
            secureTextEntry
            error={errors.password}
            style={{ marginBottom: 16 }}
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            variant="primary"
            loading={loading}
            style={{ marginBottom: 16, marginTop: 8 }}
          />

          <View className="flex-row justify-center">
            <Text className="text-gray-600">Don't have an account? </Text>
            <Text
              onPress={() => router.push("./RegisterDriverScreen")}
              className="text-black font-semibold"
            >
              Register
            </Text>
          </View>

          <View className="h-8" />
        </View>
      </ScrollView>
    </>
  );
}
