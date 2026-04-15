import React, { useRef } from "react";
import { Pressable, View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

function Stars({ rating }) {
  const safe  = Math.min(5, Math.max(0, rating ?? 0));
  const full  = Math.floor(safe);
  const half  = safe - full >= 0.25 && safe - full < 0.75;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
      {Array.from({ length: full  }).map((_, i) => <Ionicons key={`f${i}`} name="star"         size={12} color="#F59E0B" />)}
      {half &&                                       <Ionicons              name="star-half"    size={12} color="#F59E0B" />}
      {Array.from({ length: empty }).map((_, i) => <Ionicons key={`e${i}`} name="star-outline" size={12} color="#E5E7EB" />)}
      <Text style={styles.ratingNum}>{safe.toFixed(1)}</Text>
    </View>
  );
}

function Avatar({ prenom, nom, sexe }) {
  const initials = `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();
  const female   = sexe === 'F';
  return (
    <View style={[styles.avatar, { backgroundColor: female ? '#FCE4EC' : '#E8F0FE' }]}>
      <Text style={[styles.avatarText, { color: female ? '#C2185B' : '#1A73E8' }]}>{initials}</Text>
    </View>
  );
}

function MiniTag({ icon, label, iconLib = 'material' }) {
  return (
    <View style={styles.tag}>
      {iconLib === 'ionicons'
        ? <Ionicons name={icon} size={10} color="#9CA3AF" />
        : <MaterialCommunityIcons name={icon} size={10} color="#9CA3AF" />
      }
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

export default function DriverRecoCard({
  driver, isSelected = false, onPress, onLongPress, style = undefined
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={() => onPress(driver)}
      onLongPress={() => onLongPress && onLongPress(driver)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={style}
      delayLongPress={400}
    >
      <Animated.View style={[
        styles.card,
        isSelected && styles.cardSelected,
        { transform: [{ scale }] }
      ]}>

        {/* Checkmark sélectionné */}
        {isSelected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={11} color="#fff" />
          </View>
        )}

        <View style={styles.row}>
          <Avatar prenom={driver.prenom} nom={driver.nom} sexe={driver.sexe} />

          <View style={styles.body}>

            {/* Nom + dispo */}
            <View style={styles.nameLine}>
              <Text style={styles.name} numberOfLines={1}>
                {driver.prenom} {driver.nom}
              </Text>
            </View>

            <Stars rating={driver.avgRating} />

            {/* Tags */}
            <View style={styles.tagsRow}>

              {/* Distance */}
              {driver.distance_km != null && (
                <View style={styles.tag}>
                  <Ionicons name="location-outline" size={10} color="#9CA3AF" />
                  <Text style={styles.tagText}>{driver.distance_km} km</Text>
                </View>
              )}

              {/* Calme / Bavard */}
              {!driver.talkative
                ? <MiniTag icon="volume-mute"     label="Calme"      iconLib="ionicons" />
                : <MiniTag icon="chatbubbles"     label="Bavard"     iconLib="ionicons" />
              }

              {/* Radio */}
              {driver.radio_on &&
                <MiniTag icon="radio"           label="Radio"      iconLib="material" />
              }

              {/* Fumeur */}
              {driver.smoking_allowed &&
                <MiniTag icon="smoking"           label="Fumeur OK"  iconLib="material" />
              }

              {/* Animaux */}
              {driver.pets_allowed &&
                <MiniTag icon="paw"               label="Animaux"    iconLib="material" />
              }

              {/* Grand coffre */}
              {driver.car_big &&
                <MiniTag icon="car-side"          label="Grand"      iconLib="material" />
              }

            </View>
          </View>

          {/* Hint long press */}
          <View style={styles.hintCol}>
            <Ionicons name="ellipsis-vertical" size={14} color="#D1D5DB" />
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardSelected: {
    borderColor: '#111',
    backgroundColor: '#FAFAFA',
  },
  checkBadge: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
    borderWidth: 2, borderColor: '#fff',
  },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { flex: 1, gap: 5 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: 15, fontWeight: '800' },
  nameLine:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:        { fontSize: 15, fontWeight: '700', color: '#111', flex: 1 },
  dispoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F0FDF4', paddingHorizontal: 7,
    paddingVertical: 2, borderRadius: 20,
  },
  dispoDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' },
  dispoText:   { fontSize: 10, fontWeight: '700', color: '#16A34A' },
  ratingNum:   { fontSize: 11, fontWeight: '600', color: '#9CA3AF', marginLeft: 3 },
  tagsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F5F5F5', paddingHorizontal: 7,
    paddingVertical: 3, borderRadius: 6,
  },
  tagText:  { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },
  hintCol:  { paddingLeft: 4 },
});
