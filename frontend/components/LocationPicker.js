import React, { useContext, useEffect, useRef } from "react";
import { LocationContext } from "../context/LocationContext";
import { Marker } from "react-native-maps";

export default function LocationPicker({ mapRef, searchLocation }) {
  const { endLocation, setEndLocation, endAddress, setEndAddress } = useContext(LocationContext);
  const markerRef = useRef(null);

  const reverseGeocodeNominatim = async ({ latitude, longitude }) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      );
      const data = await response.json();
      if (data && data.display_name) {
        setEndAddress(data.display_name);
      } else {
        setEndAddress("Adresse inconnue");
      }
    } catch (error) {
      console.error("Erreur reverse geocoding Nominatim:", error);
      setEndAddress("Adresse inconnue");
    }
  };

  useEffect(() => {
    if (searchLocation && setEndLocation) {
      setEndLocation(searchLocation);
      reverseGeocodeNominatim(searchLocation);

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

  const handleMapPress = (event) => {
    const coords = event.nativeEvent.coordinate;
    setEndLocation(coords);
    reverseGeocodeNominatim(coords);
  };

  const handleDragEnd = (event) => {
    const coords = event.nativeEvent.coordinate;
    setEndLocation(coords);
    reverseGeocodeNominatim(coords);
  };

  if (!endLocation) return null;

  return (
    <Marker
      ref={markerRef}
      coordinate={endLocation}
      draggable
      onDragEnd={(e) => {
        const coords = e.nativeEvent.coordinate;
        setEndLocation(coords);
        reverseGeocodeNominatim(coords);
      }}
      pinColor="black"
    />
  );
}
