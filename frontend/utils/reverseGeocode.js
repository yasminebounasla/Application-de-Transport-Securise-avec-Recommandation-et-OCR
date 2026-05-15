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

  // Race the fetch against a timeout so we don't hang the UI.
  const response = await Promise.race([fetchPromise, timeoutPromise]);

  if (response.status === 429) {
    console.info('LocationIQ rate limited');
    throw new Error('RATE_LIMIT');
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  // Heuristics to detect open water / region-level results and to pick
  // the most useful display token from `display_name` when a locality
  // is not present in the `address` object.
  const displayName = (data.display_name || '');
  const displayTokens = displayName.split(',').map(cleanText).filter(Boolean);
  const displayLower = displayName.toLowerCase();
  const isWater = /\b(sea|mer|ocean|oc[eé]an|mediterran|m[eé]diterran[eé]e|atlantique|gulf|bay|lac|lake|river|fleuve|rivi[eè]re)\b/i.test(displayLower)
    || (data.class === 'natural' && /(coastline|water|bay|river|lake)/i.test(data.type || ''));

  const addr = data.address || {};
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
    addr.county ||
    addr.country
  );

  const countryName = addr.country ? cleanText(addr.country).toLowerCase() : null;
  const pickDisplayCandidate = () => {
    for (const t of displayTokens) {
      const tl = t.toLowerCase();
      if (countryName && tl === countryName) continue;
      if (/^(unnamed|unnamed road|road|route|street|rue|voie|chemin|path|file|#|\d+)$/i.test(tl)) continue;
      return t;
    }
    return displayTokens[0] || null;
  };
  const displayCandidate = pickDisplayCandidate();

  let resultText;

  if (isWater) {
    resultText = 'Over water — move pin to land';
  } else if (locality && wilaya && locality !== wilaya) {
    resultText = `${locality}, ${wilaya}`;
  } else if (locality) {
    resultText = locality;
  } else if (displayCandidate) {
    resultText = displayCandidate;
  } else if (wilaya && wilaya !== '') {
    resultText = `${wilaya} — zoom in`;
  } else if (data.display_name) {
    resultText = cleanText(data.display_name.split(',')[0]);
  } else {
    resultText = 'No address — zoom in';
  }

  const hasLocality = !!locality;
  const hasUsefulDisplay = !!displayCandidate && displayCandidate.toLowerCase() !== (countryName || '');
  const precise = !isWater && (hasLocality || hasUsefulDisplay);
  const code = isWater ? 'WATER' : precise ? 'OK' : 'REGION';

  console.log(`✅ Address: ${resultText} (precise=${precise}, code=${code})`);
  return { result: resultText, precise, code };
}

export async function reverseGeocode({ latitude, longitude }) {
  if (!latitude || !longitude) {
    console.info('Invalid coordinates provided for reverse geocoding');
    return 'Unknown location';
  }

  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;

  if (cache.has(cacheKey)) {
    console.log('🎯 Cache hit:', cacheKey);
    return cache.get(cacheKey);
  }

  try {
    const { result } = await performGeocode(latitude, longitude);
    cache.set(cacheKey, result);
    return result;
  } catch (error) {
    // Informational log: many geocoding "failures" are benign (open water,
    // country-level clicks, provider slowness). Use info-level logs to avoid
    // noisy WARN/stack traces in development terminals.
    console.info(`[Reverse geocode] ${error.message}. Coordinates: ${cacheKey}.`);

    const fallback =
      error.message === 'RATE_LIMIT'   ? 'Service busy — try again' :
      error.message === 'TIMEOUT'      ? 'No address — zoom in' :
      error.message.startsWith('HTTP 404') ? 'No address found' :
                                         'Selected location';

    cache.set(cacheKey, fallback);
    return fallback;
  }
}

// More detailed API for callers that need to know whether geocoding succeeded.
export async function reverseGeocodeDetailed({ latitude, longitude }) {
  if (!latitude || !longitude) return { result: 'Unknown location', ok: false, code: 'INVALID_COORDS' };

  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  if (cache.has(cacheKey)) {
    return { result: cache.get(cacheKey), ok: true, code: 'CACHE' };
  }

  try {
    const { result, precise, code } = await performGeocode(latitude, longitude);
    cache.set(cacheKey, result);
    return { result, ok: !!precise, code };
  } catch (error) {
    console.info(`[Reverse geocode] ${error.message} (detailed). Coordinates: ${cacheKey}.`);
    const fallback =
      error.message === 'RATE_LIMIT'   ? 'Service busy — try again' :
      error.message === 'TIMEOUT'      ? 'No address — zoom in' :
      error.message.startsWith('HTTP 404') ? 'No address found' :
                                         'Selected location';
    cache.set(cacheKey, fallback);
    return { result: fallback, ok: false, code: error.message };
  }
}