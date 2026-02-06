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
  const [passengerRides, setPassengerRides] = useState([]);
  const [driverRequests, setDriverRequests] = useState([]);
  const [currentRide, setCurrentRide] = useState(null);
  const [loading, setLoading] = useState(false);

  const createRide = async (rideData) => {
    setLoading(true);
    try {
      const response = await api.post('/rides', rideData);
      const newRide = response.data;

      setPassengerRides(prev => [newRide, ...prev]);
      
      return newRide;
    } catch (error) {
      console.error('Erreur createRide:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getPassengerRides = async (passengerId) => {
    setLoading(true);
    try {
      const response = await api.get(`/rides/passenger/${passengerId}`);
      const rides = response.data;
      
      setPassengerRides(rides);
      return rides;
    } catch (error) {
      console.error('Erreur getPassengerRides:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getDriverRequests = async (driverId) => {
    setLoading(true);
    try {
      const response = await api.get(`/rides/driver/${driverId}`);
      const requests = response.data;
      
      setDriverRequests(requests);
      return requests;
    } catch (error) {
      console.error('Erreur getDriverRequests:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const rejectRide = async (rideId) => {
    setLoading(true);
    try {
      const response = await api.put(`/rides/${rideId}/reject`);
      const updatedRide = response.data;

      setDriverRequests(prev => prev.filter(ride => ride.id !== rideId));
      
      return updatedRide;
    } catch (error) {
      console.error('Erreur rejectRide:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const startRide = async (rideId) => {
    setLoading(true);
    try {
      const response = await api.put(`/rides/${rideId}/start`);
      const updatedRide = response.data;

      setCurrentRide(updatedRide);
      
      return updatedRide;
    } catch (error) {
      console.error('Erreur startRide:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const completeRide = async (rideId) => {
    setLoading(true);
    try {
      const response = await api.put(`/rides/${rideId}/complete`);
      const updatedRide = response.data;

      setCurrentRide(null);
      
      return updatedRide;
    } catch (error) {
      console.error('Erreur completeRide:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const cancelRide = async (rideId) => {
    setLoading(true);
    try {
      const response = await api.put(`/rides/${rideId}/cancel`);
      const updatedRide = response.data;

      setPassengerRides(prev => 
        prev.map(ride => ride.id === rideId ? updatedRide : ride)
      );
      
      return updatedRide;
    } catch (error) {
      console.error('Erreur cancelRide:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    passengerRides,
    driverRequests,
    currentRide,
    loading,
    createRide,
    getPassengerRides,
    getDriverRequests,
    rejectRide,
    startRide,
    completeRide,
    cancelRide,
  };

  return (
    <RideContext.Provider value={value}>
      {children}
    </RideContext.Provider>
  );
};