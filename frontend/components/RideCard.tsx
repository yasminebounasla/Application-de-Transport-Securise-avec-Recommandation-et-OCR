import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RideCard({ ride, onAccept, onReject, onPress, showActions = true }) {
  if (!ride) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (heureDepart) => {
    return heureDepart || 'N/A';
  };

  const passenger = ride.passenger || {};
  const passengerName = `${passenger.prenom || 'Unknown'} ${passenger.nom || 'Passenger'}`;
  const passengerPhone = passenger.numTel || 'N/A';

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.passengerInfo}>
          <Ionicons name="person-circle" size={40} color="#000" />
          <View style={styles.passengerDetails}>
            <Text style={styles.passengerName}>
              {passengerName}
            </Text>
            <Text style={styles.passengerPhone}>{passengerPhone}</Text>
          </View>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{ride.status || 'PENDING'}</Text>
        </View>
      </View>

      <View style={styles.separator} />

      <View style={styles.locationContainer}>
        <View style={styles.locationRow}>
          <View style={styles.dotStart} />
          <Text style={styles.locationText} numberOfLines={1}>
            {ride.startAddress || 'Unknown location'}
          </Text>
        </View>
        
        <View style={styles.locationRow}>
          <View style={styles.dotEnd} />
          <Text style={styles.locationText} numberOfLines={1}>
            {ride.endAddress || 'Unknown destination'}
          </Text>
        </View>
      </View>

      <View style={styles.timeContainer}>
        <Ionicons name="time-outline" size={18} color="#666" />
        <Text style={styles.timeText}>
          {formatDate(ride.dateDepart)} at {formatTime(ride.heureDepart)}
        </Text>
      </View>

      {passenger && (
        <View style={styles.preferencesContainer}>
          {passenger.quiet_ride && (
            <View style={styles.tag}>
              <Ionicons name="volume-mute" size={14} color="#666" />
              <Text style={styles.tagText}>Quiet</Text>
            </View>
          )}
          {passenger.smoking_ok === false && (
            <View style={styles.tag}>
              <Ionicons name="ban" size={14} color="#666" />
              <Text style={styles.tagText}>No smoking</Text>
            </View>
          )}
          {passenger.pets_ok === false && (
            <View style={styles.tag}>
              <Ionicons name="paw" size={14} color="#666" />
              <Text style={styles.tagText}>No pets</Text>
            </View>
          )}
          {passenger.luggage_large && (
            <View style={styles.tag}>
              <Ionicons name="briefcase" size={14} color="#666" />
              <Text style={styles.tagText}>Large luggage</Text>
            </View>
          )}
        </View>
      )}

      {showActions && (
        <>
          <View style={styles.separator} />
          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.button, styles.rejectButton]}
              onPress={() => onReject(ride.id)}
            >
              <Ionicons name="close-circle" size={20} color="#000" />
              <Text style={styles.buttonTextReject}>Reject</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.acceptButton]}
              onPress={() => onAccept(ride.id)}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.buttonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  passengerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  passengerPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  locationContainer: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dotStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000',
    marginRight: 12,
  },
  dotEnd: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#666',
    marginRight: 12,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  preferencesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tagText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  rejectButton: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#000',
  },
  acceptButton: {
    backgroundColor: '#000',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextReject: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
});