import React, { useEffect } from 'react';
import { View, Text, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function Toast({ message, type, visible, onHide, duration = 3000 }) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      // Animation d'entrée
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-hide après duration ms
      const timer = setTimeout(() => {
        // Animation de sortie
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onHide();
        });
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration]);

  if (!visible) return null;

  const backgroundColor = type === 'success' ? '#D1FAE5' : '#FEE2E2'; // Vert clair : Rouge clair
  const borderColor = type === 'success' ? '#34D399' : '#F87171';
  const textColor = type === 'success' ? '#065F46' : '#991B1B';
  const iconName = type === 'success' ? 'check-circle' : 'error';
  const iconColor = type === 'success' ? '#10B981' : '#EF4444';

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 9999,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <View
        style={{
          backgroundColor,
          borderColor,
          borderWidth: 1,
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 5,
          maxWidth: 320,
        }}
      >
        <MaterialIcons name={iconName} size={24} color={iconColor} />
        <Text
          style={{
            marginLeft: 10,
            fontSize: 14,
            fontWeight: '600',
            color: textColor,
            flexShrink: 1,
          }}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}