const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanMultilingualText(text) {
  if (!text) return '';
  
  const cleaned = text
    .replace(/[\u0600-\u06FF]/g, '') 
    .replace(/[\u2D30-\u2D7F]/g, '') 
    .replace(/\s+/g, ' ') 
    .trim();
  
  return cleaned;
}

function getShortName(place) {
  const addr = place.address;
  
  const name = 
    addr.university ||
    addr.hospital ||
    addr.school ||
    addr.amenity ||
    place.name ||
    addr.suburb ||
    addr.neighbourhood ||
    addr.quarter ||
    addr.village ||
    addr.town ||
    addr.city ||
    place.display_name.split(',')[0];
  
  return cleanMultilingualText(name);
}

function getWilaya(place) {
  const addr = place.address;
  
  const wilaya = 
    addr.state ||
    addr.province ||
    addr.city ||
    addr.county;
  
  return cleanMultilingualText(wilaya);
}

function formatAddress(place) {
  const shortName = getShortName(place);
  const wilaya = getWilaya(place);
  
  if (shortName && wilaya && shortName !== wilaya) {
    return `${shortName}, ${wilaya}`;
  } else if (shortName) {
    return shortName;
  } else if (wilaya) {
    return wilaya;
  }
  
  return cleanMultilingualText(place.display_name.split(',')[0]);
}

export async function searchPlaces(query, userLocation = null) {
  if (!query || query.length < 2) return [];

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }

  try {
    lastRequestTime = Date.now();

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      countrycodes: 'dz',
      limit: '5',
      addressdetails: '1',
      'accept-language': 'fr,en'
    });

    if (userLocation?.latitude && userLocation?.longitude) {
      params.append('lat', userLocation.latitude);
      params.append('lon', userLocation.longitude);
    }

    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'my-transport-app',
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    return data.map(place => ({
      id: place.place_id,
      name: place.display_name,
      shortName: getShortName(place),
      displayName: formatAddress(place), 
      latitude: parseFloat(place.lat),
      longitude: parseFloat(place.lon),
      type: place.type,
      address: place.address
    }));

  } catch (error) {
    console.error('Erreur recherche de lieux:', error);
    return [];
  }
}