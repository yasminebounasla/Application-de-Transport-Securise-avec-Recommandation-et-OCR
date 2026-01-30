import React, { useContext, useEffect, useRef } from "react";
import { LocationContext } from "../context/LocationContext";
import MapView, { Marker } from "react-native-maps";

export default function LocationPicker({ mapRef, searchLocation }) {
  const { endLocation, setEndLocation } = useContext(LocationContext);
  const markerRef = useRef(null);

  // Si searchLocation change, déplacer le marker
  useEffect(() => {
    if (searchLocation && setEndLocation) {
      setEndLocation(searchLocation);

      // Centrer la carte sur la nouvelle position
      if (mapRef && mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: searchLocation.latitude,
            longitude: searchLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          1000
        );
      }
    }
  }, [searchLocation]);
  useEffect(() => {
    if (!mapRef?.current) return;

    const listener = mapRef.current.addListener("press", (event) => {
      const coords = event.nativeEvent.coordinate;

      setEndLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    });
    
    return () => {
      listener?.remove();
    };
  }, []);

  if (!endLocation) return null;

  return (
    <Marker
      ref={markerRef}
      coordinate={endLocation}
      draggable
      onDragEnd={(e) => setEndLocation(e.nativeEvent.coordinate)}
      pinColor="black"
    />
  );
}

