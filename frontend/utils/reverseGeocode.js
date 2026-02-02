const cache = new Map();
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function reverseGeocode({ latitude, longitude }) {
  if (!latitude || !longitude) return "Adresse inconnue";

  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }

  try {
    lastRequestTime = Date.now();
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      {
        headers: { 
          "User-Agent": "my-transport-app",
          "Accept": "application/json"
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.warn("Nominatim non-JSON:", text);
      return "Adresse inconnue";
    }

    let result = "Adresse inconnue";

    if (data.address) {
      const addr = data.address;
      
      const locality = 
        addr.suburb ||
        addr.neighbourhood ||
        addr.quarter ||
        addr.village ||
        addr.town ||
        addr.city ||
        addr.municipality ||
        addr.county;
      
      const wilaya = 
        addr.state ||
        addr.province ||
        addr.city ||
        addr.county;
      
      if (locality && wilaya && locality !== wilaya) {
        result = `${locality}, ${wilaya}`;
      } else if (locality) {
        result = locality;
      } else if (wilaya) {
        result = wilaya;
      } else if (data.display_name) {
        result = data.display_name.split(',')[0];
      }
    } else if (data.display_name) {
      result = data.display_name.split(',')[0];
    }

    cache.set(cacheKey, result);
    
    return result;

  } catch (err) {
    console.error("Reverse geocode error:", err);
    return "Adresse inconnue";
  }
}