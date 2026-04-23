import axios from 'axios';
import { calculateDistance } from '../utils/geo.js'; 

const OSRM_BASE_URL = 'https://router.project-osrm.org';
const GOOGLE_DIRECTIONS_BASE_URL = 'https://maps.googleapis.com/maps/api/directions/json';

function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const coordinates = [];

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = null;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    latitude += deltaLat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    longitude += deltaLng;

    coordinates.push([longitude / 1e5, latitude / 1e5]); // [lng, lat]
  }

  return coordinates;
}

async function calculateRouteWithGoogle(start, end) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'GOOGLE_MAPS_API_KEY is not set' };
  }

  if (!start?.latitude || !start?.longitude || !end?.latitude || !end?.longitude) {
    return { success: false, error: 'Invalid coordinates' };
  }

  try {
    const response = await axios.get(GOOGLE_DIRECTIONS_BASE_URL, {
      params: {
        origin: `${start.latitude},${start.longitude}`,
        destination: `${end.latitude},${end.longitude}`,
        mode: 'driving',
        alternatives: true,
        key: apiKey,
      },
      timeout: 30000,
    });

    const data = response.data;
    if (data?.status !== 'OK' || !Array.isArray(data.routes) || data.routes.length === 0) {
      const msg = data?.error_message || data?.status || 'No route found';
      return { success: false, error: msg };
    }

    // Choose the shortest route by total distance (fallback: first route).
    const routes = data.routes;
    const scored = routes.map((r) => {
      const legs = Array.isArray(r.legs) ? r.legs : [];
      const distance = legs.reduce((sum, leg) => sum + (leg?.distance?.value || 0), 0);
      const duration = legs.reduce((sum, leg) => sum + (leg?.duration?.value || 0), 0);
      return { route: r, legs, distance, duration };
    });
    scored.sort((a, b) => (a.distance - b.distance) || (a.duration - b.duration));
    const best = scored[0] || { route: routes[0], legs: routes[0]?.legs || [], distance: 0, duration: 0 };

    const encoded = best.route?.overview_polyline?.points;
    const coordinates = decodePolyline(encoded);

    if (!coordinates.length) {
      return { success: false, error: 'Google polyline decode failed' };
    }

    return {
      success: true,
      distance: best.distance,
      distanceKm: (best.distance / 1000).toFixed(2),
      duration: best.duration,
      durationMin: Math.round(best.duration / 60),
      geometry: { type: 'LineString', coordinates },
      waypoints: [
        { location: [start.longitude, start.latitude] },
        { location: [end.longitude, end.latitude] },
      ],
      legs: best.legs,
      steps: best.legs[0]?.steps || [],
      provider: 'google',
    };
  } catch (error) {
    return { success: false, error: error?.message || 'Google route failed' };
  }
}

async function calculateRoute(start, end) {
  try {
    if (!start?.latitude || !start?.longitude || !end?.latitude || !end?.longitude) {
      throw new Error('Coordonnées invalides');
    }

    const googleResult = await calculateRouteWithGoogle(start, end);
    if (googleResult.success) return googleResult;

    const coordinates = `${start.longitude},${start.latitude};${end.longitude},${end.latitude}`;
    
    const response = await axios.get(
      `${OSRM_BASE_URL}/route/v1/driving/${coordinates}`,
      {
        params: {
          overview: 'full',
          geometries: 'geojson',
          steps: true,
          // Ask for alternatives and pick the shortest route by distance.
          alternatives: true
        },
        timeout: 30000
      }
    );

    if (!response.data?.routes || response.data.routes.length === 0) {
      throw new Error('Aucun itinéraire trouvé');
    }

    const routes = response.data.routes;
    routes.sort((a, b) => (a.distance - b.distance) || (a.duration - b.duration));
    const route = routes[0];

    return {
      success: true,
      distance: route.distance,
      distanceKm: (route.distance / 1000).toFixed(2),
      duration: route.duration,
      durationMin: Math.round(route.duration / 60),
      geometry: route.geometry,
      waypoints: response.data.waypoints,
      legs: route.legs,
      steps: route.legs[0]?.steps || [],
      provider: 'osrm',
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
        timeout: 30000
      }
    );

    if (!response.data?.routes || response.data.routes.length === 0) {
      throw new Error('Aucun itinéraire trouvé');
    }

    const routes = response.data.routes;
    let bestIdx = 0;
    for (let i = 1; i < routes.length; i++) {
      if (
        (routes[i].distance < routes[bestIdx].distance) ||
        (routes[i].distance === routes[bestIdx].distance && routes[i].duration < routes[bestIdx].duration)
      ) {
        bestIdx = i;
      }
    }

    return {
      success: true,
      routes: routes.map((route, index) => ({
        id: index,
        distance: route.distance,
        distanceKm: (route.distance / 1000).toFixed(2),
        duration: route.duration,
        durationMin: Math.round(route.duration / 60),
        geometry: route.geometry,
        isRecommended: index === bestIdx
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
        timeout: 30000
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

export {
  calculateRoute,
  estimateTripDuration,
  calculateDistance,
  getAlternativeRoutes,
  calculateMultiPointRoute
};
