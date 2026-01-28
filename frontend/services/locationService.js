import * as Location from 'expo-location';

export async function getCurrentLocation() {
  let { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission denied');
  }
  let loc = await Location.getCurrentPositionAsync({});
  return loc.coords; 
}

export async function geocodeAddress(address) {
  const result = await Location.geocodeAsync(address);
  if (result.length === 0) return null;
  return {
    latitude: result[0].latitude,
    longitude: result[0].longitude,
  };
}
