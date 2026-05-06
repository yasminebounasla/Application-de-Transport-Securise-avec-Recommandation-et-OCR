const LOCATIONIQ_API_KEY = process.env.EXPO_PUBLIC_LOCATIONIQ_API_KEY;
// Avoid logging secrets; this is only a quick dev sanity check.
console.log('[places] LocationIQ key:', LOCATIONIQ_API_KEY ? 'LOADED' : 'MISSING');
// Use the documented autocomplete endpoint (requires .php) and request JSON explicitly
const LOCATIONIQ_AUTOCOMPLETE_URL = 'https://api.locationiq.com/v1/autocomplete.php';

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
  const wilaya = getWilaya(place);

  // 1) Prefer explicit place `name` (most specific)
  if (place.name && String(place.name).trim()) return cleanText(place.name);

  // 2) Prefer named POI/address fields from the address block
  const addrCandidates = [
    addr.attraction,
    addr.amenity,
    addr.building,
    addr.office,
    addr.shop,
    addr.tourism,
    addr.leisure,
    addr.road && addr.house_number ? `${addr.road} ${addr.house_number}` : addr.road,
    addr.suburb,
    addr.neighbourhood,
    addr.quarter,
    addr.village,
    addr.town,
    addr.city,
    addr.county,
  ];
  for (const c of addrCandidates) {
    if (c && String(c).trim()) {
      const cleaned = cleanText(String(c));
      if (cleaned && cleaned !== wilaya) return cleaned;
    }
  }

  // 3) Try display_name segments: pick the most specific segment that is not the wilaya
  const displaySegments = (place.display_name || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const seg of displaySegments) {
    if (!seg) continue;
    const cleaned = cleanText(seg);
    if (!cleaned) continue;
    if (cleaned === wilaya) continue;
    // avoid returning very short or numeric-only segments
    if (cleaned.length < 2 || /^[0-9]+$/.test(cleaned)) continue;
    return cleaned;
  }

  // 4) Last resort: return wilaya or first display segment
  if (wilaya) return wilaya;
  return cleanText(displaySegments[0] || '');
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
  // If shortName is same as wilaya, prefer a fuller display if available
  const displayFirst = cleanText(((place.display_name || '').split(',')[0]) || '');

  if (shortName && wilaya && shortName !== wilaya) {
    return `${shortName}, ${wilaya}`;
  } else if (shortName) {
    // If shortName is too generic (equal to displayFirst), prefer displayFirst which often contains more context
    if (shortName === displayFirst && place.display_name && place.display_name.split(',').length > 1) {
      return cleanText(place.display_name.split(',').slice(0, 2).join(', '));
    }
    return shortName;
  } else if (wilaya) {
    // show wilaya with a hint if we have a display name
    if (displayFirst && displayFirst !== wilaya) {
      return `${displayFirst}, ${wilaya}`;
    }
    return wilaya;
  }

  return displayFirst;
}

export async function searchPlaces(query, userLocation = null) {
  if (!query || query.length < 2) return [];
  if (!LOCATIONIQ_API_KEY) {
    console.warn('[places] Missing EXPO_PUBLIC_LOCATIONIQ_API_KEY; searchPlaces disabled.');
    return [];
  }

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
      countrycodes:   'dz',       // Algérie uniquement
      limit:          '5',
      addressdetails: '1',
      format:         'json',
      'accept-language': 'en',
    });

    // ✅ Bias vers la position de l'utilisateur si disponible
    if (userLocation?.latitude && userLocation?.longitude) {
      params.append('viewbox',
        `${userLocation.longitude - 1},${userLocation.latitude - 1},` +
        `${userLocation.longitude + 1},${userLocation.latitude + 1}`
      );
      params.append('bounded', '0'); // 0 = cherche aussi en dehors du viewbox
    }

    const url = `${LOCATIONIQ_AUTOCOMPLETE_URL}?${params.toString()}`;

    console.log('[places] Calling LocationIQ URL:', url);

    // Helper to fetch with timeout. Accepts optional fetch options (e.g., headers).
    const fetchWithTimeout = async (fetchUrl, opts = {}) => {
      const headers = { 'Accept': 'application/json', ...(opts.headers || {}) };
      const fetchPromise = fetch(fetchUrl, { ...opts, headers });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000));
      return Promise.race([fetchPromise, timeoutPromise]);
    };

    // Try the primary autocomplete endpoint, then fallback hosts/endpoints.
    const tried = [];
    const tryEndpoints = async () => {
      // Primary autocomplete URL
      tried.push(url);
      let resp = null;
      try {
        resp = await fetchWithTimeout(url);
      } catch (e) {
        // continue to fallbacks
      }

      if (resp && resp.status === 404) {
        // Try regional host
        const fallbackUrl = url.replace('api.locationiq.com', 'us1.locationiq.com');
        tried.push(fallbackUrl);
        try {
          resp = await fetchWithTimeout(fallbackUrl);
        } catch (e) {
          // ignore
        }
      }

      // If still not ok/404, try the search.php forward-geocode endpoint (same params)
      if (!resp || resp.status === 404 || !resp.ok) {
        const searchUrl = url.replace('autocomplete.php', 'search.php');
        tried.push(searchUrl);
        try {
          resp = await fetchWithTimeout(searchUrl);
        } catch (e) {
          // ignore
        }

        if (resp && resp.status === 404) {
          const searchFallback = searchUrl.replace('api.locationiq.com', 'us1.locationiq.com');
          tried.push(searchFallback);
          try {
            resp = await fetchWithTimeout(searchFallback);
          } catch (e) {
            // ignore
          }
        }
      }

      return resp;
    };

    let response = await tryEndpoints();

    // If LocationIQ failed (404/403 or network) try OpenStreetMap Nominatim as a last-resort fallback.
    if (!response || response.status === 404 || response.status === 403 || !response.ok) {
      console.warn('[places] LocationIQ failed for endpoints:', tried);

      if (response && response.status === 403) {
        console.warn('[places] LocationIQ returned 403 — access denied. API key may be invalid, expired, or restricted. Falling back to Nominatim.');
      } else {
        console.warn('[places] Falling back to Nominatim public search');
      }

      const nominatimParams = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        limit: '5',
        addressdetails: '1',
        countrycodes: 'dz',
      });
      const nominatimUrl = `https://nominatim.openstreetmap.org/search.php?${nominatimParams.toString()}`;
      try {
        // Nominatim requires a valid User-Agent or Referer header. Provide a conservative default.
        const nominatimHeaders = {
          'User-Agent': process.env.EXPO_PUBLIC_APP_NAME ? `${process.env.EXPO_PUBLIC_APP_NAME}/1.0` : 'SuiviTempsReel/1.0',
          'Referer': process.env.EXPO_PUBLIC_APP_URL || 'https://local-development',
        };
        response = await fetchWithTimeout(nominatimUrl, { headers: nominatimHeaders });
      } catch (e) {
        // final failure
      }
      if (!response) {
        console.error('[places] No response from LocationIQ or Nominatim (timeout or network error)');
        return [];
      }
    }

    if (response.status === 429) {
      console.warn('⚠️ Rate limited (429)');
      return [];
    }

    if (!response.ok) {
      console.warn(`[places] Remote search endpoint returned HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data)) return [];

    const qNorm = query.trim().toLowerCase();
    const adminTypes = new Set(['state','administrative','province','region','county','district','macroregion']);

    const results = data.map(place => {
      const shortName = getShortName(place);
      const displayName = formatAddress(place);
      const wilaya = getWilaya(place);

      const combined = (`${place.display_name || ''} ${place.name || ''} ${shortName || ''} ${Object.values(place.address || {}).join(' ')}`).toLowerCase();
      const type = (place.type || '').toLowerCase();
      const isAdminType = adminTypes.has(type);

      // Skip results that are essentially only the wilaya (too generic)
      if (displayName && wilaya && displayName === wilaya && (!shortName || shortName === wilaya)) {
        return null;
      }

      // If the user typed a query, prefer results that include the query text.
      // If the result is an administrative area and doesn't contain the query, skip it.
      if (qNorm && !combined.includes(qNorm) && isAdminType) {
        return null;
      }

      return {
        id:          place.place_id ?? place.osm_id ?? null,
        name:        place.display_name,
        shortName,
        displayName,
        latitude:    parseFloat(place.lat ?? place.latitude ?? NaN),
        longitude:   parseFloat(place.lon ?? place.longitude ?? NaN),
        type:        place.type,
        address:     place.address,
      };
    }).filter(Boolean).filter(r => !Number.isNaN(r.latitude) && !Number.isNaN(r.longitude));

    return results;

  } catch (error) {
    console.error('❌ searchPlaces error:', error.message);
    return [];
  }
}
