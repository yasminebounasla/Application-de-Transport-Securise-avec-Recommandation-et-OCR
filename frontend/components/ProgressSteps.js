import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function ProgressSteps({ currentStep }) {
  const total = 3;

  return (
    <View style={styles.wrap}>
      <Text style={styles.counter}>
        {currentStep} of {total}
      </Text>
      <View style={styles.barWrap}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[styles.bar, i < currentStep && styles.barActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  counter: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 6,
    textAlign: 'center',
  },
  barWrap: {
    flexDirection: 'row',
    gap: 4,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 99,
    backgroundColor: '#E5E7EB',
  },
  barActive: {
    backgroundColor: '#000',
  },
});
