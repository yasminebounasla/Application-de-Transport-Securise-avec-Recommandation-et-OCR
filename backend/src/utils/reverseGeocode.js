const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;

export const reverseGeocode = async (lat, lng) => {
  const url = `https://us1.locationiq.com/v1/reverse?key=${LOCATIONIQ_API_KEY}&lat=${lat}&lon=${lng}&format=json&accept-language=fr`;

  const res  = await fetch(url, {
    headers: { "Accept": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`LocationIQ error: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.address || null;
};