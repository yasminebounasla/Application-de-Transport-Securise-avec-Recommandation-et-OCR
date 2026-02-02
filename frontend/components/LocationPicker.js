import React, { useContext, useEffect, useRef } from "react";
import { LocationContext } from "../context/LocationContext";
import { Marker } from "react-native-maps";
import { reverseGeocode } from "../utils/reverseGeocode";

export default function LocationPicker({ mapRef, searchLocation }) {
  const { endLocation, setEndLocation, setEndAddress } =
    useContext(LocationContext);

  const markerRef = useRef(null);

  // Quand une localisation est fournie depuis recherche
  useEffect(() => {
    const loadAddress = async () => {
      if (!searchLocation) return;

      setEndLocation(searchLocation);
      const address = await reverseGeocode(searchLocation);
      setEndAddress(address);

      if (mapRef?.current) {
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
    };

    loadAddress();
  }, [searchLocation]);

  // Click sur carte
  const handleMapPress = async (event) => {
    const coords = event.nativeEvent.coordinate;
    setEndLocation(coords);
    const address = await reverseGeocode(coords);
    setEndAddress(address);
  };

  // Drag marker
  const handleDragEnd = async (event) => {
    const coords = event.nativeEvent.coordinate;
    setEndLocation(coords);
    const address = await reverseGeocode(coords);
    setEndAddress(address);
  };

  if (!endLocation) return null;

  return (
    <Marker
      ref={markerRef}
      coordinate={endLocation}
      draggable
      onPress={handleMapPress}
      onDragEnd={handleDragEnd}
      pinColor="black"
    />
  );
}
