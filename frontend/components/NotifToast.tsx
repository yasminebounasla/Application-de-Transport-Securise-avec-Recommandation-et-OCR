import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ✅ Type exporté — NotificationContext.tsx l'importe pour typer currentToast
export type ToastData = {
  title: string;
  message: string;
  color: string;
  icon: string;
};

type NotifToastProps = {
  toast: ToastData | null;
  onHide: () => void;
  duration?: number;
};

// ✅ Composant séparé de Toast.tsx existant
// POURQUOI: Toast.tsx est fait pour le tracking (type 'success'|'error', message simple).
//           NotifToast est fait pour les notifications socket :
//           - title + message (deux lignes)
//           - color et icon dynamiques selon le type de notif
//           - Ionicons au lieu de MaterialIcons
//           - design cohérent avec NotificationsScreen.tsx
export default function NotifToast({ toast, onHide, duration = 3500 }: NotifToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toast) return;

    // Reset les valeurs avant animation (si toast précédent encore visible)
    opacity.setValue(0);
    translateY.setValue(-20);

    // Annule le timer précédent si un nouveau toast arrive
    if (timerRef.current) clearTimeout(timerRef.current);

    // Animation entrée
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-hide
    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start(() => onHide());
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast]);

  if (!toast) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.card, { borderLeftColor: toast.color }]}>
        {/* Icône colorée */}
        <View style={[styles.iconWrap, { backgroundColor: toast.color + '20' }]}>
          <Ionicons name={toast.icon as any} size={20} color={toast.color} />
        </View>

        {/* Texte */}
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{toast.title}</Text>
          <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>
        </View>

        {/* Bouton fermer */}
        <TouchableOpacity onPress={onHide} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  closeBtn: {
    padding: 2,
  },
});