import api from './api';

export async function calculateRouteAPI(start, end) {
  try {
    console.log('📍 Calcul itinéraire:', { start, end });
    
    const response = await api.post('/ride/calculate', {
      start,
      end
    });

    console.log('✅ Réponse backend:', response.data);

    const data = response.data;

    if (!data.success) {
      throw new Error(data.error || 'Erreur de calcul');
    }

    return data;

  } catch (error) {
    console.error('❌ Erreur calcul itinéraire:', error);
    
    if (error.message === 'Network request failed') {
      throw new Error('Impossible de contacter le serveur. Vérifiez que le backend est démarré.');
    }
    
    if (error.response) {
      throw new Error(error.response.data?.error || 'Erreur serveur');
    }
    
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