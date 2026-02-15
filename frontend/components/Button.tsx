import React from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";

export default function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [ // Ajouté effet pressed
        styles.base,
        variant === "primary" ? styles.primary : styles.secondary,
        isDisabled && styles.disabled,
        pressed && styles.pressed, // Feedback visuel
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "white" : "#111827"} />
      ) : (
        <Text
          style={[
            styles.text,
            variant === "primary" ? styles.primaryText : styles.secondaryText,
          ]}
        >
          {title}
        </Text>
      )}
      
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: "#000000",
  },
  secondary: {
    backgroundColor: "white",
    borderWidth: 2, 
    borderColor: "#D1D5DB",
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: { 
    opacity: 0.8,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
  primaryText: {
    color: "white",
  },
  secondaryText: {
    color: "#000000",
  },
});