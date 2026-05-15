const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY || process.env.EXPO_PUBLIC_LOCATIONIQ_API_KEY;

export const reverseGeocode = async (lat, lng) => {
  if (!LOCATIONIQ_API_KEY) {
    throw new Error(
      'Missing LocationIQ API key. Set LOCATIONIQ_API_KEY or EXPO_PUBLIC_LOCATIONIQ_API_KEY in your environment.'
    );
  }

  const url = `https://us1.locationiq.com/v1/reverse?key=${LOCATIONIQ_API_KEY}&lat=${lat}&lon=${lng}&format=json&accept-language=fr`;

  try {
    // Use AbortController to avoid hanging requests in case the provider is slow.
    let controller;
    let signal;
    let timeoutId;
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      signal = controller.signal;
      timeoutId = setTimeout(() => controller.abort(), 8000);
    }

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!res.ok) {
      console.info(`Reverse geocode: LocationIQ responded HTTP ${res.status} for coordinates (${lat}, ${lng}).`);
      return null;
    }

    const data = await res.json();

    if (!data || !data.address) {
      const display = (data?.display_name || '').toLowerCase();
      const isWater = /(sea|mer|ocean|oc[eé]an|mediterran|m[eé]diterran[eé]e|atlantique|gulf|bay|lac|lake|river|fleuve|rivi[eè]re)/i.test(display)
        || (data?.class === 'natural' && /(coastline|water|bay|river|lake)/i.test(data?.type || ''));

      if (isWater) {
        console.info(`Reverse geocode: Over water at (${lat}, ${lng}).`);
      } else {
        console.info(`Reverse geocode: Region-level result for (${lat}, ${lng}).`);
      }
      return null;
    }

    const addr = data.address || {};
    const hasLocality = addr.city || addr.town || addr.village || addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district;
    if (!hasLocality) {
      console.info(`Reverse geocode: Region-level address: ${addr.country || addr.state || 'unknown'} for (${lat}, ${lng}).`);
    }

    return data.address || null;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.info(`Reverse geocode: request timed out for (${lat}, ${lng}).`);
      return null;
    }
    console.error('Reverse geocode: unexpected error', err);
    return null;
  }
};
