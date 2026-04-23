import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { API_URL } from '../services/api';

type Props = {
  prenom?: string | null;
  nom?: string | null;
  photoUrl?: string | null;
  sexe?: string | null;
  size?: number;
  backgroundColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fallback?: React.ReactNode;
};

function getInitials(prenom?: string | null, nom?: string | null) {
  const p = (prenom ?? '').trim();
  const n = (nom ?? '').trim();
  const i = `${p[0] ?? ''}${n[0] ?? ''}`.toUpperCase();
  return i || '';
}

function getAvatarColors(sexe?: string | null) {
  const val = (sexe ?? '').toLowerCase().trim();
  if (val === 'f' || val === 'female' || val === 'femme' || val === 'woman') {
    return { bg: '#FCE4EC', text: '#C2185B' };
  }
  return { bg: '#E8F0FE', text: '#1A73E8' };
}

function resolvePhotoUrl(input?: string | null) {
  const raw = (input ?? '').trim();
  if (!raw) return '';
  // If it's already an absolute URL, keep it unless it's an `/uploads/...` URL
  // with a stale host (common when switching LAN IP / tunnel / localhost).
  if (/^(file|content):/i.test(raw)) return raw;

  const base =
    (process.env.EXPO_PUBLIC_API_URL_SANS_API?.trim() ||
      String(API_URL || '').replace(/\/api$/i, '')).replace(/\/+$/, '');

  if (/^(https?:)?\/\//i.test(raw)) {
    if (!base) return raw;
    try {
      const u = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
      const idx = u.pathname.indexOf('/uploads/');
      if (idx >= 0) {
        const uploadsPath = u.pathname.slice(idx);
        return `${base}${uploadsPath}${u.search || ''}`;
      }
      return raw;
    } catch {
      return raw;
    }
  }

  if (!base) return raw;
  if (raw.startsWith('/')) return `${base}${raw}`;
  return `${base}/${raw}`;
}

export default function UserAvatar({
  prenom,
  nom,
  photoUrl,
  sexe,
  size = 36,
  backgroundColor,
  textColor,
  style,
  textStyle,
  fallback,
}: Props) {
  const [broken, setBroken] = useState(false);

  const initials = useMemo(() => getInitials(prenom, nom), [prenom, nom]);
  const url = useMemo(() => resolvePhotoUrl(photoUrl), [photoUrl]);
  const colors = useMemo(() => getAvatarColors(sexe), [sexe]);

  useEffect(() => {
    setBroken(false);
  }, [url]);

  const bg = backgroundColor ?? colors.bg;
  const fg = textColor ?? colors.text;

  const fontSize = Math.max(11, Math.round(size * 0.36));

  return (
    <View
      style={[
        s.wrap,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        style,
      ]}
    >
      {!!url && !broken ? (
        <Image
          source={{ uri: url }}
          style={s.img}
          resizeMode="cover"
          onError={() => setBroken(true)}
        />
      ) : initials ? (
        <Text style={[s.txt, { color: fg, fontSize }, textStyle]}>{initials}</Text>
      ) : (
        fallback ?? <Text style={[s.txt, { color: fg, fontSize }, textStyle]}>?</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  txt: { fontWeight: '800' },
});
