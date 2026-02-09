// install the icons first with expo install @expo/vector-icons

import React from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function DriverRecoCard({
  driver,
  isSelected = false,
  onPress,
  style,
}) {

  return (
    <Pressable
      onPress={() => onPress(driver)}
      style={({ pressed }) => [
        styles.card,
        isSelected && styles.selected,
        pressed && styles.pressed,
        style,
      ]}
    >
        
      {/* Header avec nom et rating */}
      <View style={styles.header}>
        <View style={styles.nameContainer}>

          <Text style={styles.name}>
            {driver.prenom} {driver.nom}
          </Text>

          <View style={styles.genderRow}>
            <Ionicons 
              name={driver.sexe === 'F' ? "woman" : "man"} 
              size={16} 
              color="#6B7280" 
            />
            <Text style={styles.gender}>{driver.age} ans</Text>
          </View>

        </View>

        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={18} color="#F59E0B" />
          <Text style={styles.ratingText}>
            {driver.note?.toFixed(1) || '4.5'}
          </Text>
        </View>
      </View>

      {/* Infos de contact */}
      <View style={styles.contactInfo}>
        <View style={styles.contactRow}>
          <Ionicons name="mail-outline" size={14} color="#6B7280" />
          <Text style={styles.contact} numberOfLines={1}>
            {driver.email}
          </Text>
        </View>
        <View style={styles.contactRow}>
          <Ionicons name="call-outline" size={14} color="#6B7280" />
          <Text style={styles.contact}>{driver.numTel}</Text>
        </View>
      </View>

      {/* Caractéristiques */}
      <View style={styles.features}>
        <View style={styles.featureRow}>
          <FeatureTag 
            Icon={() => <Ionicons name="car-sport" size={14} color="#374151" />}
            text={driver.car_big ? 'Grande voiture' : 'Standard'} 
          />
          <FeatureTag 
            Icon={() => <Ionicons 
              name={driver.talkative ? "chatbubbles" : "volume-mute"} 
              size={14} 
              color="#374151" 
            />}
            text={driver.talkative ? 'Bavard(e)' : 'Silencieux(se)'} 
          />
        </View>
        
        <View style={styles.featureRow}>
          {driver.radio_on && (
            <FeatureTag 
              Icon={() => <Ionicons name="musical-notes" size={14} color="#374151" />}
              text="Radio" 
            />
          )}
          {driver.smoking_allowed && (
            <FeatureTag 
              Icon={() => <MaterialCommunityIcons name="smoking" size={14} color="#374151" />}
              text="Fumeur OK" 
            />
          )}
          {driver.pets_allowed && (
            <FeatureTag 
              Icon={() => <MaterialCommunityIcons name="paw" size={14} color="#374151" />}
              text="Animaux" 
            />
          )}
        </View>
      </View>

      {/* Badge de sélection */}
      {isSelected && (
        <View style={styles.selectedBadge}>
          <Ionicons name="checkmark-circle" size={20} color="#000" />
          <Text style={styles.selectedText}>Sélectionné</Text>
        </View>
      )}
    </Pressable>
  );
}

// Composant pour les tags de caractéristiques
function FeatureTag({ Icon, text }) {
  return (
    <View style={styles.tag}>
      <Icon />
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selected: {
    borderColor: '#000000',
    backgroundColor: '#F9FAFB',
    borderWidth: 3,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
  },
  genderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gender: {
    fontSize: 13,
    color: '#6B7280',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFAE5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  ratingText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'gray',
  },

  // Contact
  contactInfo: {
    marginBottom: 12,
    gap: 6,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contact: {
    fontSize: 13,
    color: '#4B5563',
    flex: 1,
  },

  // Features
  features: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  tagText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },

  // Selected badge
  selectedBadge: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  selectedText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
});