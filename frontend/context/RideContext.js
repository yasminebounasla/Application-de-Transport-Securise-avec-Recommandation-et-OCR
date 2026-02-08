import React, { createContext, useState, useContext } from 'react';
import api from '../services/api';

const RideContext = createContext();

export const useRide = () => {
  const context = useContext(RideContext);
  if (!context) {
    throw new Error('useRide doit être utilisé dans un RideProvider');
  }
  return context;
};

export const RideProvider = ({ children }) => {

  const [passengerRides, setPassengerRides] = useState([]); // Trajets du passager
  const [driverRequests, setDriverRequests] = useState([]);  // Demandes PENDING pour le conducteur
  const [currentRide, setCurrentRide] = useState(null);      // Trajet actif (IN_PROGRESS)
  const [loading, setLoading] = useState(false);

  const createRide = async (rideData) => {
    setLoading(true);
    try {
      const response = await api.post('/ridesDem', rideData);
      const newRide = response.data.data; 

      setPassengerRides(prev => [newRide, ...prev]);
      
      return newRide;
    } catch (error) {
      console.error('❌ Erreur createRide:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getPassengerRides = async (passengerId) => {
    setLoading(true);
    try {
      const response = await api.get(`/ridesDem/passenger/${passengerId}`);
      const rides = response.data.data; 
      
      setPassengerRides(rides);
      return rides;
    } catch (error) {
      console.error('❌ Erreur getPassengerRides:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getDriverRequests = async (driverId) => {
    setLoading(true);
    try {
      const response = await api.get(`/ridesDem/driver/${driverId}`);
      const requests = response.data.data;
      
      setDriverRequests(requests);
      return requests;
    } catch (error) {
      console.error('❌ Erreur getDriverRequests:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const acceptRide = async (rideId, driverId) => {
    setLoading(true);
    try {
      const response = await api.put(`/ridesDem/${rideId}/accept`, { driverId });
      const updatedRide = response.data.data;

      setDriverRequests(prev => prev.filter(ride => ride.id !== rideId));
      
      return updatedRide;
    } catch (error) {
      console.error('❌ Erreur acceptRide:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const rejectRide = async (rideId) => {
    setLoading(true);
    try {
      const response = await api.put(`/ridesDem/${rideId}/reject`);
      const updatedRide = response.data.data;

      setDriverRequests(prev => prev.filter(ride => ride.id !== rideId));
      
      return updatedRide;
    } catch (error) {
      console.error('❌ Erreur rejectRide:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const startRide = async (rideId) => {
    setLoading(true);
    try {
      const response = await api.put(`/ridesDem/${rideId}/start`);
      const updatedRide = response.data.data;

      setCurrentRide(updatedRide);
      
      return updatedRide;
    } catch (error) {
      console.error('❌ Erreur startRide:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const completeRide = async (rideId) => {
    setLoading(true);
    try {
      const response = await api.put(`/ridesDem/${rideId}/complete`);
      const updatedRide = response.data.data;

      setCurrentRide(null);
      
      return updatedRide;
    } catch (error) {
      console.error('❌ Erreur completeRide:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const cancelRide = async (rideId) => {
    setLoading(true);
    try {
      const response = await api.put(`/ridesDem/${rideId}/cancel`);
      const updatedRide = response.data.data;

      setPassengerRides(prev => 
        prev.map(ride => ride.id === rideId ? updatedRide : ride)
      );
      
      return updatedRide;
    } catch (error) {
      console.error('❌ Erreur cancelRide:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    // État
    passengerRides,   // Liste des rides du passager
    driverRequests,   // Liste des demandes PENDING pour le conducteur
    currentRide,      // Ride actuellement en cours (IN_PROGRESS)
    loading,          // Indicateur de chargement
    
    // Fonctions
    createRide,       // Créer une demande
    getPassengerRides,// Récupérer rides du passager
    getDriverRequests,// Récupérer demandes PENDING
    acceptRide,       // Accepter une demande (conducteur)
    rejectRide,       // Refuser une demande (conducteur)
    startRide,        // Démarrer un trajet
    completeRide,     // Terminer un trajet
    cancelRide,       // Annuler un trajet (passager)
  };

  return (
    <RideContext.Provider value={value}>
      {children}
    </RideContext.Provider>
  );
};