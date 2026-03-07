/**
 * Geovalidation.js
 * Validation géographique via Nominatim (OpenStreetMap reverse geocoding).
 * 100% précis — utilise les vraies frontières officielles.
 */

const LOCATIONIQ_KEY = process.env.EXPO_PUBLIC_LOCATIONIQ_API_KEY;

/**
 * Vérifie si une coordonnée est en Algérie via LocationIQ reverse geocoding.
 */
export async function isInAlgeria(location) {
  if (!location || location.latitude == null || location.longitude == null) {
    return false;
  }

  const { latitude, longitude } = location;

  // Bounding box rapide avant l'appel API (optimisation)
  if (
    latitude  < 18.96 || latitude  > 37.20 ||
    longitude < -8.67 || longitude > 11.98
  ) {
    console.log('❌ Hors bounding box Algérie');
    return false;
  }

  try {
    const response = await fetch(
      `https://us1.locationiq.com/v1/reverse?key=${LOCATIONIQ_KEY}&lat=${latitude}&lon=${longitude}&format=json`,
    );

    if (!response.ok) {
      console.warn(`⚠️ LocationIQ error ${response.status}, fallback polygone`);
      return isInAlgeriaFallback(location);
    }

    const data = await response.json();
    const countryCode = data?.address?.country_code?.toUpperCase();

    console.log(`📍 LocationIQ (${latitude}, ${longitude}): country_code = ${countryCode}`);

    return countryCode === 'DZ';

  } catch (error) {
    console.warn('⚠️ LocationIQ indisponible, fallback polygone:', error.message);
    return isInAlgeriaFallback(location);
  }
}

/**
 * Fallback polygone si Nominatim est indisponible.
 */
const ALGERIA_POLYGON = [
  { lat: 35.1717, lng: -2.2170 },
  { lat: 34.8780, lng: -1.7924 },
  { lat: 34.0000, lng: -1.6000 },
  { lat: 33.2000, lng: -1.6500 },
  { lat: 32.0800, lng: -1.2500 },
  { lat: 30.0000, lng: -2.0000 },
  { lat: 29.0000, lng: -1.2500 },
  { lat: 27.6577, lng: -8.6670 },
  { lat: 24.9945, lng: -8.6670 },
  { lat: 23.4728, lng: -5.9000 },
  { lat: 21.8000, lng: -5.2000 },
  { lat: 21.3307, lng: -4.8300 },
  { lat: 21.0000, lng: -3.5000 },
  { lat: 20.4000, lng: -2.5000 },
  { lat: 19.8000, lng: -1.5000 },
  { lat: 19.4000, lng:  0.5000 },
  { lat: 19.1670, lng:  3.1670 },
  { lat: 19.4000, lng:  4.0000 },
  { lat: 19.5700, lng:  5.7700 },
  { lat: 20.0000, lng:  6.5000 },
  { lat: 20.5000, lng:  7.5000 },
  { lat: 21.0000, lng:  8.5000 },
  { lat: 21.8000, lng:  9.0000 },
  { lat: 22.5000, lng:  9.3800 },
  { lat: 23.9000, lng:  9.5500 },
  { lat: 24.9500, lng: 11.5600 },
  { lat: 25.0000, lng: 11.9800 },
  { lat: 26.5000, lng: 11.9800 },
  { lat: 28.0000, lng: 11.5000 },
  { lat: 30.4000, lng:  9.5200 },
  { lat: 33.1400, lng:  9.5000 },
  { lat: 33.1700, lng:  8.4300 },
  { lat: 36.4670, lng:  8.2250 },
  { lat: 37.0930, lng:  8.5730 },
  { lat: 37.0900, lng:  8.6000 },
  { lat: 37.1100, lng:  5.1000 },
  { lat: 36.9400, lng:  3.0600 },
  { lat: 35.8500, lng:  0.2200 },
  { lat: 35.7500, lng: -0.7300 },
  { lat: 35.3500, lng: -1.2000 },
  { lat: 35.1717, lng: -2.2170 },
];

function isPointInPolygon(lat, lng, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isInAlgeriaFallback(location) {
  console.log('⚠️ Fallback polygone utilisé');
  return isPointInPolygon(location.latitude, location.longitude, ALGERIA_POLYGON);
}

/**
 * Valide que les deux points sont en Algérie.
 * ⚠️ Cette fonction est async — utilise await dans SearchRideScreen.
 */
export async function validateLocationsInAlgeria(start, end) {
  console.log('🔍 Validation géographique:');
  console.log('  Départ:', start);
  console.log('  Destination:', end);

  const [startInAlgeria, endInAlgeria] = await Promise.all([
    isInAlgeria(start),
    isInAlgeria(end),
  ]);

  console.log('  Départ en Algérie:', startInAlgeria);
  console.log('  Destination en Algérie:', endInAlgeria);

  if (!startInAlgeria && !endInAlgeria) {
    return {
      valid: false,
      message: "Le point de départ et la destination sont en dehors de l'Algérie",
      startValid: false,
      endValid: false,
    };
  }
  if (!startInAlgeria) {
    return {
      valid: false,
      message: "Le point de départ est en dehors de l'Algérie",
      startValid: false,
      endValid: true,
    };
  }
  if (!endInAlgeria) {
    return {
      valid: false,
      message: "La destination est en dehors de l'Algérie",
      startValid: true,
      endValid: false,
    };
  }

  return {
    valid: true,
    message: "Les deux points sont en Algérie",
    startValid: true,
    endValid: true,
  };
}

/**
 * Retourne le nom du pays via Nominatim.
 */
export async function getApproximateCountry(location) {
  if (!location) return "Inconnu";
  try {
    const response = await fetch(
      `https://us1.locationiq.com/v1/reverse?key=${LOCATIONIQ_KEY}&lat=${location.latitude}&lon=${location.longitude}&format=json`
    );
    const data = await response.json();
    return data?.address?.country || "Inconnu";
  } catch {
    return "Inconnu";
  }
}

export function getAlgeriaBounds() {
  return { minLat: 18.96, maxLat: 37.20, minLng: -8.67, maxLng: 11.98 };
}