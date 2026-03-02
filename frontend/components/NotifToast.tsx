import React, { useEffect, useRef } from 'react';
import {
  Animated, Text, View, StyleSheet,
  TouchableOpacity, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ToastData = {
  title: string;
  message: string;
  color?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

type Props = {
  toast: ToastData | null;
  onHide: () => void;
};

function ProgressBar({ color, duration }: { color: string; duration: number }) {
  const width = useRef(new Animated.Value(100)).current;
  useEffect(() => {
    width.setValue(100);
    Animated.timing(width, {
      toValue: 0,
      duration,
      useNativeDriver: false,
    }).start();
  }, []);
  return (
    <View style={styles.progressBg}>
      <Animated.View
        style={[
          styles.progressBar,
          {
            backgroundColor: color,
            width: width.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

export default function NotifToast({ toast, onHide }: Props) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const hide = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 300, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onHide());
  };

  useEffect(() => {
    if (!toast) return;
    translateY.setValue(-120);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => hide(), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  const color = toast.color ?? '#3B82F6';
  const icon = toast.icon ?? 'notifications';

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
      <TouchableOpacity activeOpacity={0.95} onPress={hide} style={styles.inner}>
        <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{toast.title}</Text>
          <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>
        </View>
        <TouchableOpacity onPress={hide} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={16} color="#AAA" />
        </TouchableOpacity>
      </TouchableOpacity>
      <ProgressBar color={color} duration={4000} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 40,
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 2 },
  message: { fontSize: 12, color: '#666', lineHeight: 17 },
  progressBg: { height: 3, backgroundColor: '#F0F0F0' },
  progressBar: { height: 3 },
});