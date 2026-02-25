import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  SafeAreaView
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { recommendDrivers } from '../../services/recommendationService';
import DriverRecoCard from '../../components/DriverRecommendationCard';

export default function RecommendedDriversScreen() {
  const params = useLocalSearchParams();
  
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      setLoading(true);

      const tripRequestData = await AsyncStorage.getItem('tripRequest');
      
      if (!tripRequestData) {
        Alert.alert('Error', 'Ride information is missing');
        router.back();
        return;
      }

      const tripRequest = JSON.parse(tripRequestData);

      const response = await recommendDrivers(
        tripRequest.passengerId,
        tripRequest.preferences
      );

    

      // Vérifier la structure de la réponse
      if (response.recommendedDrivers && response.recommendedDrivers.length > 0) {

        setDrivers(response.recommendedDrivers);
        
      } else {
        
        Alert.alert('Info', 'No drivers available for your preferences');
      }

    } catch (error) {
      Alert.alert(
        'Error',
        error.response?.data?.message || error.message || 'Recommendation service unavailable'
      );

    } finally {
      setLoading(false);
    }
  };

  const handleSelectDriver = (driver) => {
    setSelectedDriver(driver);
  };

  const handleConfirmReservation = async () => {
    if (!selectedDriver) {
      Alert.alert('Warning', 'Please select a driver');
      return;
    }

    Alert.alert(
      'Confirmation',
      `Confirm reservation with ${selectedDriver.prenom} ${selectedDriver.nom} ?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            console.log('Reservation confirmed with driver', selectedDriver.id);
            
            await AsyncStorage.removeItem('tripRequest');
            
           // router.replace('/passenger/HomeScreen');
          }
        }
      ]
    );
  };

  // Render simplifié avec le nouveau composant
  const renderDriver = ({ item }) => (
    <DriverRecoCard
      driver={item}
      isSelected={selectedDriver?.id === item.id}
      onPress={handleSelectDriver}
      style
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>
          Recherche des meilleurs conducteurs...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Conducteurs recommandés</Text>
        <Text style={styles.subtitle}>
          {params.depart} → {params.destination}
        </Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {drivers.length} conducteur{drivers.length > 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Liste */}
      <FlatList
        data={drivers}
        renderItem={renderDriver}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}></Text>
            <Text style={styles.emptySubtext}>Aucun conducteur disponible</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadRecommendations}
            >
              <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Bouton de confirmation */}
      <TouchableOpacity
        style={[styles.confirmButton, !selectedDriver && styles.disabled]}
        onPress={handleConfirmReservation}
        disabled={!selectedDriver}
      >
        <Text style={styles.confirmText}>
          {selectedDriver 
            ? `Réserver avec ${selectedDriver.prenom}` 
            : 'Sélectionnez un conducteur'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  headerContainer: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 6,
  },
  countBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 12,
  },
  countText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'black',
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  confirmButton: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#000',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  disabled: {
    backgroundColor: '#D1D5DB',
  },
  confirmText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  empty: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
});