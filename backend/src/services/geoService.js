const axios = require('axios');
const { calculateDistance } = require('../utils/geo');

const OSRM_BASE_URL = 'https://router.project-osrm.org';

async function calculateRoute(start, end) {
  try {
    if (!start?.latitude || !start?.longitude || !end?.latitude || !end?.longitude) {
      throw new Error('Coordonnées invalides');
    }

    const coordinates = `${start.longitude},${start.latitude};${end.longitude},${end.latitude}`;
    
    const response = await axios.get(
      `${OSRM_BASE_URL}/route/v1/driving/${coordinates}`,
      {
        params: {
          overview: 'full',
          geometries: 'geojson',
          steps: true,
          alternatives: false
        },
        timeout: 10000
      }
    );

    if (!response.data?.routes || response.data.routes.length === 0) {
      throw new Error('Aucun itinéraire trouvé');
    }

    const route = response.data.routes[0];

    return {
      success: true,
      distance: route.distance,
      distanceKm: (route.distance / 1000).toFixed(2),
      duration: route.duration,
      durationMin: Math.round(route.duration / 60),
      geometry: route.geometry,
      legs: route.legs,
      steps: route.legs[0]?.steps || []
    };

  } catch (error) {
    console.error('Erreur lors du calcul de l\'itinéraire:', error.message);
    
    return {
      success: false,
      error: error.message,
      distance: null,
      duration: null
    };
  }
}

async function estimateTripDuration(start, end) {
  try {
    const result = await calculateRoute(start, end);

    if (!result.success) {
      throw new Error(result.error || 'Impossible de calculer la durée');
    }

    return {
      success: true,
      duration: result.duration,
      durationMin: result.durationMin,
      distance: result.distance,
      distanceKm: result.distanceKm,
      estimatedArrival: new Date(Date.now() + result.duration * 1000).toISOString()
    };

  } catch (error) {
    console.error('Erreur lors de l\'estimation de durée:', error.message);
    
    return {
      success: false,
      error: error.message,
      duration: null,
      distance: null
    };
  }
}

async function getAlternativeRoutes(start, end, numAlternatives = 2) {
  try {
    const coordinates = `${start.longitude},${start.latitude};${end.longitude},${end.latitude}`;
    
    const response = await axios.get(
      `${OSRM_BASE_URL}/route/v1/driving/${coordinates}`,
      {
        params: {
          overview: 'full',
          geometries: 'geojson',
          alternatives: Math.min(numAlternatives, 3),
          steps: true
        },
        timeout: 10000
      }
    );

    if (!response.data?.routes || response.data.routes.length === 0) {
      throw new Error('Aucun itinéraire trouvé');
    }

    return {
      success: true,
      routes: response.data.routes.map((route, index) => ({
        id: index,
        distance: route.distance,
        distanceKm: (route.distance / 1000).toFixed(2),
        duration: route.duration,
        durationMin: Math.round(route.duration / 60),
        geometry: route.geometry,
        isRecommended: index === 0
      }))
    };

  } catch (error) {
    console.error('Erreur lors de la recherche d\'itinéraires alternatifs:', error.message);
    
    return {
      success: false,
      error: error.message,
      routes: []
    };
  }
}

async function calculateMultiPointRoute(points) {
  try {
    if (!points || points.length < 2) {
      throw new Error('Au moins 2 points sont nécessaires');
    }

    const coordinates = points
      .map(point => `${point.longitude},${point.latitude}`)
      .join(';');

    const response = await axios.get(
      `${OSRM_BASE_URL}/route/v1/driving/${coordinates}`,
      {
        params: {
          overview: 'full',
          geometries: 'geojson',
          steps: true
        },
        timeout: 15000
      }
    );

    if (!response.data?.routes || response.data.routes.length === 0) {
      throw new Error('Aucun itinéraire trouvé');
    }

    const route = response.data.routes[0];

    return {
      success: true,
      distance: route.distance,
      distanceKm: (route.distance / 1000).toFixed(2),
      duration: route.duration,
      durationMin: Math.round(route.duration / 60),
      geometry: route.geometry,
      legs: route.legs,
      waypoints: response.data.waypoints
    };

  } catch (error) {
    console.error('Erreur lors du calcul de l\'itinéraire multi-points:', error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  calculateRoute,
  estimateTripDuration,
  calculateStraightLineDistance,
  getAlternativeRoutes,
  calculateMultiPointRoute
};