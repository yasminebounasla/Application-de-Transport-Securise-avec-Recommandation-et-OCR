import React, { createContext, useState, useEffect } from "react";
import * as Location from "expo-location";
import { getCurrentLocation } from "../services/locationService";

export const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  const [endAddress, setEndAddress] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // ✅ Essaie getCurrentLocation
        const loc = await getCurrentLocation();
        setCurrentLocation(loc);
        setStartLocation(loc);
      } catch (error) {
        console.warn("GPS unavailable, trying last known position...", error);
        try {
          // ✅ Fallback : dernière position connue
          const last = await Location.getLastKnownPositionAsync();
          if (last) {
            setCurrentLocation(last.coords);
            setStartLocation(last.coords);
          } else {
            // ✅ Fallback final : Alger par défaut
            const defaultLocation = { latitude: 36.7538, longitude: 3.0588 };
            setCurrentLocation(defaultLocation);
            setStartLocation(defaultLocation);
          }
        } catch (e) {
          const defaultLocation = { latitude: 36.7538, longitude: 3.0588 };
          setCurrentLocation(defaultLocation);
          setStartLocation(defaultLocation);
        }
      }
    })();
  }, []);

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        startLocation,
        endLocation,
        endAddress,
        setStartLocation,
        setEndLocation,
        setEndAddress,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};
