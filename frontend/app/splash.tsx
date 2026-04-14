import { useEffect } from "react";
import { View, Image, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Stack } from "expo-router"; // ✅ ADD

export default function SplashScreen() {
  useEffect(() => {
    setTimeout(() => {
      router.replace("/home");
    }, 3500);
  }, []);

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
  logo: { width: 190, height: 190 },
});
