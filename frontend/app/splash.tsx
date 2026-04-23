import { useEffect, useMemo, useRef } from "react";
import { View, Image, StyleSheet } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useAuth } from "../context/AuthContext";

export default function SplashScreen() {
  const { loading, isAuthenticated, user } = useAuth();
  const params = useLocalSearchParams<{ target?: string; mode?: string }>();
  const hasNavigatedRef = useRef(false);

  const nextRoute = useMemo(() => {
    if (typeof params.target === "string" && params.target.length > 0) {
      return params.target;
    }

    if (isAuthenticated) {
      return user?.role === "driver"
        ? "/(driverTabs)/DriverHomeScreen"
        : "/(passengerTabs)/PassengerHomeScreen";
    }

    return "/home";
  }, [isAuthenticated, params.target, user?.role]);

  useEffect(() => {
    if (loading || hasNavigatedRef.current) return;

    const delay = params.mode === "transition" ? 900 : 1800;
    const timeout = setTimeout(() => {
      hasNavigatedRef.current = true;
      router.replace(nextRoute as any);
    }, delay);

    return () => clearTimeout(timeout);
  }, [loading, nextRoute, params.mode]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <Image
          source={require("../assets/logo-app.jpg")}
          style={styles.logo}
          resizeMode='contain'
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  logo: { width: 210, height: 210 },
});
