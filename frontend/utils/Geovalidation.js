const ALGERIA_BOUNDS = {
  minLat: 18.96,  
  maxLat: 37.09,  
  minLng: -8.67, 
  maxLng: 11.98,  
};
const MOROCCO_BOUNDS = {
  minLat: 21.0,
  maxLat: 36.0,
  minLng: -17.0, 
  maxLng: -1.0,   
};


const TUNISIA_BOUNDS = {
  minLat: 30.2,
  maxLat: 37.5,
  minLng: 7.5,
  maxLng: 11.6,
};

const LIBYA_BOUNDS = {
  minLat: 19.5,
  maxLat: 33.2,
  minLng: 9.3,
  maxLng: 25.0,
};

export function isInAlgeria(location) {
  if (!location || !location.latitude || !location.longitude) {
    return false;
  }

  const { latitude, longitude } = location;

  const inAlgeriaBounds =
    latitude >= ALGERIA_BOUNDS.minLat &&
    latitude <= ALGERIA_BOUNDS.maxLat &&
    longitude >= ALGERIA_BOUNDS.minLng &&
    longitude <= ALGERIA_BOUNDS.maxLng;

  if (!inAlgeriaBounds) {
    console.log('❌ Hors bounding box Algérie');
    return false;
  }

  if (longitude < -1.0 && latitude > 27.0) {
    console.log('❌ Détecté comme Maroc (lng < -1°)');
    return false;
  }

  if (longitude > 8.5 && latitude > 35.0) {
    const inTunisia =
      latitude >= TUNISIA_BOUNDS.minLat &&
      latitude <= TUNISIA_BOUNDS.maxLat &&
      longitude >= TUNISIA_BOUNDS.minLng &&
      longitude <= TUNISIA_BOUNDS.maxLng;
    
    if (inTunisia) {
      console.log('❌ Détecté comme Tunisie');
      return false;
    }
  }

  if (longitude > 11.5) {
    console.log('❌ Détecté comme Libye (lng > 11.5°)');
    return false;
  }

  console.log('✅ Coordonnée en Algérie');
  return true;
}

export function validateLocationsInAlgeria(start, end) {
  console.log('🔍 Validation géographique:');
  console.log('  Départ:', start);
  console.log('  Destination:', end);

  const startInAlgeria = isInAlgeria(start);
  const endInAlgeria = isInAlgeria(end);

  console.log('  Départ en Algérie:', startInAlgeria);
  console.log('  Destination en Algérie:', endInAlgeria);

  if (!startInAlgeria && !endInAlgeria) {
    return {
      valid: false,
      message: "Le point de départ et la destination sont en dehors de l'Algérie",
      startValid: false,
      endValid: false,
    };
  }

  if (!startInAlgeria) {
    return {
      valid: false,
      message: "Le point de départ est en dehors de l'Algérie",
      startValid: false,
      endValid: true,
    };
  }

  if (!endInAlgeria) {
    return {
      valid: false,
      message: "La destination est en dehors de l'Algérie",
      startValid: true,
      endValid: false,
    };
  }

  return {
    valid: true,
    message: "Les deux points sont en Algérie",
    startValid: true,
    endValid: true,
  };
}

export function getApproximateCountry(location) {
  if (!location) return "Inconnu";

  if (isInAlgeria(location)) {
    return "Algérie 🇩🇿";
  }

  const { latitude, longitude } = location;

  if (longitude < -1.0 && latitude > 27.0) return "Maroc 🇲🇦";
  if (longitude > 8.5 && latitude > 35.0) return "Tunisie 🇹🇳";
  if (longitude > 11.5) return "Libye 🇱🇾";
  if (latitude > 37.09) return "Méditerranée 🌊";
  if (latitude < 18.96) return "Mali/Niger 🇲🇱🇳🇪";

  return "Hors Algérie";
}

export function getAlgeriaBounds() {
  return ALGERIA_BOUNDS;
}

export function testCoordinates() {
  const tests = [
    { name: "Alger", lat: 36.7538, lng: 3.0588 },
    { name: "Oran", lat: 35.6969, lng: -0.6331 },
    { name: "Casablanca (Maroc)", lat: 33.5731, lng: -7.5898 },
    { name: "Tunis (Tunisie)", lat: 36.8065, lng: 10.1815 },
    { name: "Tindouf (frontière)", lat: 27.6719, lng: -8.1475 },
  ];

  console.log('\n🧪 Test de validation géographique:\n');
  tests.forEach(test => {
    const result = isInAlgeria({ latitude: test.lat, longitude: test.lng });
    console.log(`${result ? '✅' : '❌'} ${test.name}: ${test.lat}, ${test.lng}`);
  });
}