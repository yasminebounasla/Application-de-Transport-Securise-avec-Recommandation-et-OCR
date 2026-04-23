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
    let mounted = true;
    let locationSubscription = null;

    const setFallbackLocation = async () => {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last && mounted) {
          setCurrentLocation(last.coords);
          setStartLocation((prev) => prev || last.coords);
          return;
        }
      } catch (e) {}

      if (mounted) {
        const defaultLocation = { latitude: 36.7538, longitude: 3.0588 };
        setCurrentLocation(defaultLocation);
        setStartLocation((prev) => prev || defaultLocation);
      }
    };

    (async () => {
      try {
        const loc = await getCurrentLocation();
        if (mounted) {
          setCurrentLocation(loc);
          setStartLocation((prev) => prev || loc);
        }

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (position) => {
            if (!mounted) return;
            setCurrentLocation(position.coords);
          },
        );
      } catch (error) {
        console.warn("GPS unavailable, trying last known position...", error);
        await setFallbackLocation();
      }
    })();

    return () => {
      mounted = false;
      locationSubscription?.remove?.();
    };
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
