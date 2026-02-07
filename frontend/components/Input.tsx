// import React from "react";
// import { View, Text, TextInput, StyleSheet } from "react-native";

// interface InputProps {
//   label?: string;
//   value: string;
//   onChangeText: (text: string) => void;
//   placeholder?: string;
//   secureTextEntry?: boolean;
//   keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
//   error?: string; // ✅ Optionnel avec ?
//   style?: any;
// }

// export default function Input({
//   label,
//   value,
//   onChangeText,
//   placeholder,
//   secureTextEntry = false,
//   keyboardType = "default",
//   error,
//   style,
// }: InputProps) {
//   return (
//     <View style={[styles.wrapper, style]}>
//       {!!label && <Text style={styles.label}>{label}</Text>}
//       <TextInput
//         value={value}
//         onChangeText={onChangeText}
//         placeholder={placeholder}
//         secureTextEntry={secureTextEntry}
//         keyboardType={keyboardType}
//         style={[styles.input, !!error && styles.inputError]}
//         placeholderTextColor="#9CA3AF"
//       />
//       {!!error && <Text style={styles.error}>{error}</Text>}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   wrapper: { gap: 6 },
//   label: { fontSize: 14, color: "#111827", fontWeight: "500" },
//   input: {
//     height: 48,
//     borderRadius: 12,
//     paddingHorizontal: 14,
//     borderWidth: 1,
//     borderColor: "#E5E7EB",
//     backgroundColor: "white",
//     fontSize: 16,
//     color: "#111827",
//   },
//   inputError: { borderColor: "#EF4444" },
//   error: { color: "#EF4444", fontSize: 12 },
// });

import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  error?: string;
  style?: any;
}

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = "default",
  error,
  style,
}: InputProps) {
  return (
    <View style={[styles.wrapper, style]}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        style={[styles.input, !!error && styles.inputError]}
        placeholderTextColor="#9CA3AF"
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { 
    marginBottom: 0, // ✅ Enlève le margin par défaut
  },
  label: { 
    fontSize: 14, 
    color: "#111827", 
    fontWeight: "500",
    marginBottom: 8, // ✅ Espace entre label et input
  },
  input: {
    height: 56, // ✅ Augmenté de 48 à 56 pour matcher les boutons
    borderRadius: 16, // ✅ Même que les boutons (rounded-2xl)
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB", // ✅ Fond légèrement gris comme bg-gray-50
    fontSize: 16,
    color: "#111827",
  },
  inputError: { 
    borderColor: "#EF4444" 
  },
  error: { 
    color: "#EF4444", 
    fontSize: 12,
    marginTop: 4, // ✅ Petit espace au-dessus de l'erreur
  },
});