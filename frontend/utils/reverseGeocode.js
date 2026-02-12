const cache = new Map();
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 seconde (LocationIQ est plus permissif)

// ✅ LocationIQ API Key
const LOCATIONIQ_API_KEY = 'pk.18d0f1cca3e1780f246f04c6c53d8d1c';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/[\u0600-\u06FF\u2D30-\u2D7F]/g, '') // Supprime arabe & tifinagh
    .replace(/\s+/g, ' ')
    .trim();
}

async function performGeocode(latitude, longitude) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }

  lastRequestTime = Date.now();

  console.log(`📡 LocationIQ geocoding: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);

  const url = `https://us1.locationiq.com/v1/reverse?key=${LOCATIONIQ_API_KEY}&lat=${latitude}&lon=${longitude}&format=json&accept-language=en`;

  const fetchPromise = fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), 8000)
  );

  const response = await Promise.race([fetchPromise, timeoutPromise]);

  if (response.status === 429) {
    console.warn('⚠️ LocationIQ rate limited');
    throw new Error('RATE_LIMIT');
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  let result = 'Unknown location';

  if (data.address) {
    const addr = data.address;

    const locality = cleanText(
      addr.suburb ||
      addr.neighbourhood ||
      addr.quarter ||
      addr.village ||
      addr.town ||
      addr.city_district ||
      addr.city
    );

    const wilaya = cleanText(
      addr.state ||
      addr.province ||
      addr.county
    );

    if (locality && wilaya && locality !== wilaya) {
      result = `${locality}, ${wilaya}`;
    } else if (locality) {
      result = locality;
    } else if (wilaya) {
      result = wilaya;
    } else if (data.display_name) {
      result = cleanText(data.display_name.split(',')[0]);
    }
  } else if (data.display_name) {
    result = cleanText(data.display_name.split(',')[0]);
  }

  console.log(`✅ Address: ${result}`);
  return result;
}

export async function reverseGeocode({ latitude, longitude }) {
  if (!latitude || !longitude) {
    console.warn('⚠️ Invalid coordinates');
    return 'Unknown location';
  }

  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;

  if (cache.has(cacheKey)) {
    console.log('🎯 Cache hit:', cacheKey);
    return cache.get(cacheKey);
  }

  try {
    const result = await performGeocode(latitude, longitude);
    cache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('❌ Reverse geocode failed:', error.message);

    const fallback =
      error.message === 'RATE_LIMIT'   ? 'Selected location' :
      error.message === 'TIMEOUT'      ? 'Location (timeout)' :
                                         'Selected location';

    cache.set(cacheKey, fallback);
    return fallback;
  }
}