import express from 'express';
const router = express.Router();

const cache = new Map();
let lastRequestTime = 0;
const MIN_INTERVAL = 2000;

router.post('/reverse-geocode', async (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ address: 'Invalid coordinates' });
  }

  const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;

  if (cache.has(cacheKey)) {
    return res.json({ address: cache.get(cacheKey) });
  }

  // Rate limiting
  const now = Date.now();
  const timeSince = now - lastRequestTime;
  if (timeSince < MIN_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL - timeSince));
  }
  lastRequestTime = Date.now();

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14`,
      {
        headers: {
          'User-Agent': 'TransportApp/1.0',
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    let address = 'Unknown location';
    if (data.address) {
      const locality = data.address.suburb || data.address.city || data.address.town;
      const wilaya = data.address.state || data.address.province;
      address = locality && wilaya ? `${locality}, ${wilaya}` : locality || wilaya || address;
    }

    cache.set(cacheKey, address);
    res.json({ address });

  } catch (error) {
    console.error('Geocode error:', error);
    const fallback = `Location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`;
    cache.set(cacheKey, fallback);
    res.json({ address: fallback });
  }
});

export default router;