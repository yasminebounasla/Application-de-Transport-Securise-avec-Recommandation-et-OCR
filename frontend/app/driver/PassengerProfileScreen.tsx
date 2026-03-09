import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function PassengerProfileScreen() {
  const { ride: rideString } = useLocalSearchParams();
  const ride = JSON.parse(rideString as string);
  const router = useRouter();

  const passenger = ride.passenger || {};  // ← ligne manquante !

  const passengerName = `${passenger.prenom || 'Unknown'} ${passenger.nom || 'Passenger'}`;
  const passengerPhone = passenger.numTel || 'N/A';
  const passengerAge = passenger.age || 'N/A';

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const InfoRow = ({ icon, label, value }: { icon: any, label: string, value: string }) => (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color="#666" style={styles.infoIcon} />
      <View>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  const preferences = [
    { key: 'quiet_ride', icon: 'volume-mute', label: 'Quiet ride' },
    { key: 'radio_ok', icon: 'radio', label: 'Radio OK' },
    { key: 'smoking_ok', icon: 'flame', label: 'Smoking OK' },
    { key: 'pets_ok', icon: 'paw', label: 'Pets OK' },
    { key: 'luggage_large', icon: 'briefcase', label: 'Large luggage' },
    { key: 'female_driver_pref', icon: 'woman', label: 'Female driver pref' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Passenger Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Avatar & Name */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color="#FFF" />
          </View>
          <Text style={styles.name}>{passengerName}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{ride.status || 'PENDING'}</Text>
          </View>
        </View>

        {/* Passenger Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}> Passenger Info</Text>
          <InfoRow icon="call-outline" label="Phone" value={passengerPhone} />
          <InfoRow icon="calendar-outline" label="Age" value={`${passengerAge} years`} />
          {passenger.email && (
            <InfoRow icon="mail-outline" label="Email" value={passenger.email} />
          )}
        </View>

        {/* Ride Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}> Ride Details</Text>

          <View style={styles.locationBlock}>
            <View style={styles.locationRow}>
              <View style={styles.dotStart} />
              <View style={styles.locationTexts}>
                <Text style={styles.locationLabel}>From</Text>
                <Text style={styles.locationValue}>
                  {ride.startAddress || ride.depart || 'N/A'}
                </Text>
              </View>
            </View>
            <View style={styles.verticalLine} />
            <View style={styles.locationRow}>
              <View style={styles.dotEnd} />
              <View style={styles.locationTexts}>
                <Text style={styles.locationLabel}>To</Text>
                <Text style={styles.locationValue}>
                  {ride.endAddress || ride.destination || 'N/A'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <InfoRow icon="calendar-outline" label="Date" value={formatDate(ride.dateDepart)} />
          <InfoRow icon="time-outline" label="Time" value={ride.heureDepart || 'N/A'} />
          <InfoRow icon="people-outline" label="Seats" value={`${ride.placesDispo} seat(s)`} />
          <InfoRow icon="cash-outline" label="Price" value={`${ride.prix} DA`} />
        </View>

        {/* Preferences */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Trip Preferences</Text>
          <View style={styles.tagsContainer}>
            {preferences.map(({ key, icon, label }) => {
              const value = ride[key];
              const isYes = value === 'yes' || value === true;
              return (
                <View
                  key={key}
                  style={[styles.tag, isYes ? styles.tagActive : styles.tagInactive]}
                >
                  <Ionicons
                    name={icon as any}
                    size={14}
                    color={isYes ? '#000' : '#AAA'}
                  />
                  <Text style={[styles.tagText, !isYes && styles.tagTextInactive]}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  backButton: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  content: { padding: 16, paddingBottom: 40 },

  profileSection: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#000', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  name: { fontSize: 22, fontWeight: '700', color: '#000', marginBottom: 8 },
  statusBadge: {
    backgroundColor: '#F0F0F0', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#DDD',
  },
  statusText: { fontSize: 13, fontWeight: '600', color: '#333' },

  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    marginBottom: 16, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 16 },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  infoIcon: { marginRight: 12, marginTop: 2 },
  infoLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
  infoValue: { fontSize: 15, color: '#000', fontWeight: '500' },

  locationBlock: { marginBottom: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  verticalLine: { width: 2, height: 20, backgroundColor: '#DDD', marginLeft: 5, marginVertical: 2 },
  dotStart: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#000', marginRight: 12 },
  dotEnd: { width: 12, height: 12, borderRadius: 2, backgroundColor: '#666', marginRight: 12 },
  locationTexts: { flex: 1 },
  locationLabel: { fontSize: 11, color: '#999' },
  locationValue: { fontSize: 14, color: '#333', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 12 },

  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 12, borderWidth: 1, gap: 5,
  },
  tagActive: { backgroundColor: '#F5F5F5', borderColor: '#000' },
  tagInactive: { backgroundColor: '#FAFAFA', borderColor: '#E8E8E8' },
  tagText: { fontSize: 12, color: '#000', fontWeight: '500' },
  tagTextInactive: { color: '#BBB' },
});