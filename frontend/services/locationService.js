import * as Location from 'expo-location';

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission denied');
  }

  // ✅ Ajout try-catch + fallback
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return loc.coords;
  } catch (error) {
    // Fallback si GPS indisponible (émulateur, GPS éteint)
    try {
      const loc = await Location.getLastKnownPositionAsync();
      if (loc) return loc.coords;
    } catch (_) {}
    throw new Error('Current location is unavailable. Make sure GPS is enabled.');
  }
}

export async function geocodeAddress(address) {
  try {
    const result = await Location.geocodeAsync(address);
    if (result.length === 0) return null;
    return {
      latitude: result[0].latitude,
      longitude: result[0].longitude,
    };
  } catch (error) {
    console.error('Geocode failed:', error);
    return null;
  }
}
