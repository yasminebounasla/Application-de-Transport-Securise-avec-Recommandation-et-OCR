import React, { createContext, useState, useEffect } from "react";
import { getCurrentLocation } from "../services/locationService"; 

export const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);

  
  useEffect(() => {
    (async () => {
      const loc = await getCurrentLocation(); 
      setCurrentLocation(loc);
      setStartLocation(loc); 
    })();
  }, []);

  return (
    <LocationContext.Provider
      value={{ currentLocation, startLocation, endLocation, setStartLocation, setEndLocation }}
    >
      {children}
    </LocationContext.Provider>
  );
};
