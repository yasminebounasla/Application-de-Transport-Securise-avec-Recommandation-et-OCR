import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import api from '../services/api';
import { initSocket } from '../services/socket';
import { useAuth } from './AuthContext';

const RideContext = createContext();

export const useRide = () => {
  const context = useContext(RideContext);
  if (!context) {
    throw new Error('useRide doit être utilisé dans un RideProvider');
  }
  return context;
};

export const RideProvider = ({ children }) => {
  const { user } = useAuth();
  const [passengerRides, setPassengerRides] = useState([]);
  const [driverRequests, setDriverRequests] = useState([]);
  const [currentRide, setCurrentRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [driverLocationsByRide, setDriverLocationsByRide] = useState({});
  const passengerSocketRef = useRef(null);
  const passengerListenerRef = useRef(null);
  const passengerPollInFlightRef = useRef(false);
  const passengerConsecutiveFailuresRef = useRef(0);
  const passengerLastLoggedAtRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    let interval = null;

    const clearPassengerListener = () => {
      if (passengerSocketRef.current && passengerListenerRef.current) {
        passengerSocketRef.current.off('driverLocationUpdate', passengerListenerRef.current);
      }
      passengerListenerRef.current = null;
    };

    const subscribeToActivePassengerRides = async () => {
      if (!user || user.role !== 'passenger') return;
      if (passengerPollInFlightRef.current) return;
      passengerPollInFlightRef.current = true;
      try {
        const response = await api.get('/ridesDem/my-rides');
        const rides = response.data?.data || [];
        if (mounted) setPassengerRides(rides);
        passengerConsecutiveFailuresRef.current = 0;
  
        const activeRides = rides.filter((r) => ['ACCEPTED', 'IN_PROGRESS'].includes(r.status));
        if (activeRides.length === 0) {
          passengerPollInFlightRef.current = false;
          return;
        }

        const sock = await initSocket();
        passengerSocketRef.current = sock;

        clearPassengerListener();

        const onDriverLocationUpdate = ({ rideId, location }) => {
          if (!rideId || !location) return;
          setDriverLocationsByRide((prev) => ({
            ...prev,
            [String(rideId)]: location,
          }));
        };

        passengerListenerRef.current = onDriverLocationUpdate;
        sock.on('driverLocationUpdate', onDriverLocationUpdate);

        activeRides.forEach((ride) => {
          sock.emit('subscribeToRide', ride.id);
        });

        passengerPollInFlightRef.current = false;
      } catch (error) {
        passengerConsecutiveFailuresRef.current += 1;
        passengerPollInFlightRef.current = false;

        const now = Date.now();
        const shouldLog = now - passengerLastLoggedAtRef.current > 15000; // avoid log spam
        if (!shouldLog) return;

        passengerLastLoggedAtRef.current = now;
        const baseURL = error?.config?.baseURL;
        const url = error?.config?.url;
        const code = error?.code;
        const server = error?.response?.data;

        // In React Native, "Network Error" usually means the device cannot reach the host/port.
        console.error(
          '❌ Erreur auto-tracking passager:',
          server || error.message,
          baseURL && url ? `(GET ${String(baseURL)}${String(url)})` : '',
          code ? `(code ${String(code)})` : '',
          passengerConsecutiveFailuresRef.current >= 3
            ? 'Check phone + PC same Wi-Fi and Windows firewall for port 4040.'
            : ''
        );

        return;
        console.error('❌ Erreur auto-tracking passager:', error.response?.data || error.message);
      }
    };

    if (user?.role === 'passenger') {
      subscribeToActivePassengerRides();
      interval = setInterval(subscribeToActivePassengerRides, 15000);
    } else {
      setDriverLocationsByRide({});
    }

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
      clearPassengerListener();
    };
  }, [user?.id, user?.role]);

  const createRide = async (rideData) => {
    setLoading(true);
    try {
      console.log('📤 Envoi requête createRide:', rideData);
      
      const response = await api.post('/ridesDem', rideData);
      const newRide = response.data.data;

      console.log('✅ Ride créé:', newRide);
      
      setPassengerRides(prev => [newRide, ...prev]);
      
      return newRide;
    } catch (error) {
      console.error('❌ Erreur createRide:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getPassengerRides = async () => {
    setLoading(true);
    try {
      console.log('📡 Récupération des rides du passager...');
      
      const response = await api.get('/ridesDem/my-rides');
      
      console.log('✅ Passenger rides:', response.data);
      
      setPassengerRides(response.data.data || []);
    } catch (error) {
      console.error('❌ Erreur getPassengerRides:', error);
      setPassengerRides([]);
    } finally {
      setLoading(false);
    }
  };

  const getDriverRequests = async () => {
    setLoading(true);
    try {
      console.log('📡 Appel GET /ridesDem/driver/requests...');
      
      const response = await api.get('/ridesDem/driver/requests');
      
      console.log('✅ Response status:', response.status);
      console.log('✅ Response data:', response.data);
      console.log('📊 Nombre de rides:', response.data.count);
      
      if (response.data.data && response.data.data.length > 0) {
        console.log('📦 Premier ride:', response.data.data[0]);
        console.log('👤 Passenger du premier ride:', response.data.data[0].passenger);
        
        if (!response.data.data[0].passenger) {
          console.error('❌ PROBLÈME: passenger est undefined !');
        }
      } else {
        console.log('⚠️ Aucun ride retourné par le backend');
      }
      
      setDriverRequests(response.data.data || []);
    } catch (error) {
      console.error('❌ Erreur getDriverRequests:', error.response?.data || error.message);
      setDriverRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const getDriverActiveRide = async () => {
    setLoading(true);
    try {
      const response = await api.get('/ridesDem/driver/active');
      const activeRides = response.data?.data || [];
      const latestActiveRide = activeRides[0] || null;
      setCurrentRide(latestActiveRide);
      return latestActiveRide;
    } catch (error) {
      console.error('❌ Erreur getDriverActiveRide:', error.response?.data || error.message);
      setCurrentRide(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const acceptRide = async (rideId) => {
    try {
      console.log('✅ Acceptation du ride:', rideId);
      
      const response = await api.put(`/ridesDem/${rideId}/accept`);
      const acceptedRide = response.data.data;
      
      console.log('✅ Ride accepté:', response.data);
      setCurrentRide(acceptedRide);
      
      return acceptedRide;
    } catch (error) {
      console.error('❌ Erreur acceptRide:', error);
      throw error;
    }
  };

  const rejectRide = async (rideId) => {
    try {
      console.log('❌ Rejet du ride:', rideId);
      
      const response = await api.put(`/ridesDem/${rideId}/reject`);
      
      console.log('✅ Ride rejeté:', response.data);
      
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur rejectRide:', error);
      throw error;
    }
  };

  const cancelRide = async (rideId) => {
    try {
      console.log('🚫 Annulation du ride:', rideId);
      
      const response = await api.put(`/ridesDem/${rideId}/cancel`);
      
      console.log('✅ Ride annulé:', response.data);
      
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur cancelRide:', error);
      throw error;
    }
  };

  // Ajoute cette fonction DANS le RideProvider (après cancelRide)

  const listenToRideStatus = (trajetId, callback) => {
    console.log('🔊 Début écoute du trajet:', trajetId);

    // Polling toutes les 3 secondes
    const interval = setInterval(async () => {
      try {
        console.log('📡 Vérification du statut...');
        
        // Appel à ton API pour récupérer le trajet
        const response = await api.get(`/ridesDem/${trajetId}`);
        const updatedRide = response.data.data;
        
        console.log('📊 Statut actuel:', updatedRide.status);
        
        // Met à jour currentRide
        setCurrentRide(updatedRide);
        
        // Appelle le callback pour notifier le screen
        callback(updatedRide);
        
      } catch (error) {
        console.error('❌ Erreur polling:', error);
      }
    }, 3000); // Toutes les 3 secondes

    // Retourne la fonction de nettoyage (pour arrêter l'écoute)
    return () => {
      console.log('🛑 Arrêt de l\'écoute du trajet');
      clearInterval(interval);
    };
  };

  // Ajoute cette fonction aussi

  const getRideById = async (trajetId) => {
    setLoading(true);
    try {
      console.log('📡 Récupération du trajet:', trajetId);
      
      const response = await api.get(`/ridesDem/${trajetId}`);
      const ride = response.data.data;
      
      console.log('✅ Trajet récupéré:', ride);
      
      // Met à jour currentRide
      setCurrentRide(ride);
      
      return ride;
    } catch (error) {
      console.error('❌ Erreur getRideById:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const completeRide = async (rideId) => {
    try {
      console.log('🏁 Completion du ride:', rideId);

      const response = await api.put(`/ridesDem/${rideId}/complete`);

      console.log('✅ Ride completed:', response.data);

      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur completeRide:', error);
      throw error;
    }
  };

  const getDriverLocationForRide = (rideId) => {
    if (!rideId) return null;
    return driverLocationsByRide[String(rideId)] || null;
  };


  const value = {
    passengerRides,
    driverRequests,
    currentRide,
    loading,
    createRide,
    getPassengerRides,
    getDriverRequests,
    getDriverActiveRide,
    acceptRide,
    rejectRide,
    cancelRide,
    listenToRideStatus,
    getRideById,
    completeRide,
    getDriverLocationForRide
  };

  return <RideContext.Provider value={value}>{children}</RideContext.Provider>;
};
