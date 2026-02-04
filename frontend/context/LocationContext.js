import React, { createContext, useState, useEffect } from "react";
import { getCurrentLocation } from "../services/locationService"; 

export const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  const [endAddress, setEndAddress] = useState(null);

  
  useEffect(() => {
    (async () => {
      const loc = await getCurrentLocation(); 
      setCurrentLocation(loc);
      setStartLocation(loc); 
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
       setEndAddress
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};
