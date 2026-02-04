import { API_URL } from './api';

export async function calculateRouteAPI(start, end) {
  try {
    const response = await fetch(`${API_URL}/ride/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ start, end }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Erreur de calcul');
    }

    return data;

  } catch (error) {
    console.error('Erreur calcul itinéraire:', error);
    throw error;
  }
}

export function isInAlgeria(latitude, longitude) {
  const ALGERIA_BOUNDS = {
    north: 37.5,
    south: 18.5,
    east: 12,
    west: -8.7
  };

  return (
    latitude >= ALGERIA_BOUNDS.south &&
    latitude <= ALGERIA_BOUNDS.north &&
    longitude >= ALGERIA_BOUNDS.west &&
    longitude <= ALGERIA_BOUNDS.east
  );
}