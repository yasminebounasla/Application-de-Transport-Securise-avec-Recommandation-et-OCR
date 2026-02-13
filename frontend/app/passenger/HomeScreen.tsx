import { View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import Button from '../../components/Button';
import FeedbackModal from '../../components/FeedbackModal';
import { useEffect, useState } from 'react';
import { useRide } from '../../context/RideContext';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = "http://192.168.1.69:5000/api";

export default function Home() {
  const { getPassengerRides, passengerRides } = useRide();
  
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [completedRideId, setCompletedRideId] = useState<number | null>(null);

  useEffect(() => {
    getPassengerRides();
  }, []);

  useEffect(() => {
    const handleRides = async () => {
      if (passengerRides.length === 0) return;

      // Ride actif
      const activeRide = passengerRides.find(
        (ride: any) => ride.status === 'ACCEPTED' || ride.status === 'IN_PROGRESS'
      );
      
      if (activeRide) {
        router.replace({
          pathname: '/passenger/RideTrackingScreen' as any,
          params: { trajetId: activeRide.id.toString() }
        });
        return;
      }

      // Ride completed
      const completedRide = passengerRides.find(
        (ride: any) => ride.status === 'COMPLETED'
      );
      
      if (completedRide) {
        try {
          const token = await AsyncStorage.getItem('token');
          const response = await axios.get(
            `${API_URL}/feedback/trajet/${completedRide.id}`,
            { headers: { Authorization: token ? `Bearer ${token}` : undefined } }
          );
          
          const feedbackExists = response.data.data.length > 0;
          
          if (!feedbackExists) {
            setCompletedRideId(completedRide.id);
            setShowFeedbackModal(true);

          } else {
            console.log("Feedback already submitted");
          }

        } catch (err) {
          console.error("Erreur check feedback:", err);
        }
      }
    };

    handleRides();
  }, [passengerRides]);

  return (
    <>
      <ScrollView className="flex-1 bg-white">
        <View className="flex-1 bg-white p-4">
          <Button
            title="Open Search Ride"
            onPress={() => router.push('/passenger/SearchRideScreen' as any)}
            variant="primary"
            style={{ marginTop: 16 }}
          />
          <Button 
            title="Request a Ride"
            onPress={() => router.push('/passenger/DemandeTrajetScreen' as any)}
            variant="secondary"
            style={{ marginTop: 16 }}
          />
        </View>
      </ScrollView>

      <FeedbackModal
        visible={showFeedbackModal}
        trajetId={completedRideId}
        onClose={() => {
          setShowFeedbackModal(false);
          setCompletedRideId(null);
          getPassengerRides();
        }}
      />
    </>
  );
}