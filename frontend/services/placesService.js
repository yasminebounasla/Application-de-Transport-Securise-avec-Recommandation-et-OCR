const LOCATIONIQ_API_KEY = 'pk.18d0f1cca3e1780f246f04c6c53d8d1c';
const LOCATIONIQ_BASE_URL = 'https://us1.locationiq.com/v1';

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/[\u0600-\u06FF]/g, '')  
    .replace(/[\u2D30-\u2D7F]/g, '')  
    .replace(/\s+/g, ' ')
    .trim();
}

function getShortName(place) {
  const addr = place.address || {};

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
    (place.display_name && place.display_name.split(',')[0]);

  return cleanText(name);
}

function getWilaya(place) {
  const addr = place.address || {};

  const wilaya =
    addr.state ||
    addr.province ||
    addr.city ||
    addr.county;

  return cleanText(wilaya);
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

  return cleanText((place.display_name || '').split(',')[0]);
}

export async function searchPlaces(query, userLocation = null) {
  if (!query || query.length < 2) return [];

  // ✅ Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }

  try {
    lastRequestTime = Date.now();

    const params = new URLSearchParams({
      key:            LOCATIONIQ_API_KEY,
      q:              query,
      format:         'json',
      countrycodes:   'dz',       // Algérie uniquement
      limit:          '5',
      addressdetails: '1',
      'accept-language': 'en',
    });

    // ✅ Bias vers la position de l'utilisateur si disponible
    if (userLocation?.latitude && userLocation?.longitude) {
      params.append('viewboxlbrt',
        `${userLocation.longitude - 1},${userLocation.latitude - 1},` +
        `${userLocation.longitude + 1},${userLocation.latitude + 1}`
      );
      params.append('bounded', '0'); // 0 = cherche aussi en dehors du viewbox
    }

    const url = `${LOCATIONIQ_BASE_URL}/search?${params.toString()}`;

    const fetchPromise = fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    // ✅ Timeout 8 secondes
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 8000)
    );

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (response.status === 429) {
      console.warn('⚠️ LocationIQ rate limited (429)');
      return [];
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) return [];

    return data.map(place => ({
      id:          place.place_id,
      name:        place.display_name,
      shortName:   getShortName(place),
      displayName: formatAddress(place),
      latitude:    parseFloat(place.lat),
      longitude:   parseFloat(place.lon),
      type:        place.type,
      address:     place.address,
    }));

  } catch (error) {
    console.error('❌ searchPlaces error:', error.message);
    return [];
  }
}