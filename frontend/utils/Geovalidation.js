const ALGERIA_BOUNDS = {
  minLat: 18.96,  
  maxLat: 37.09,  
  minLng: -8.67, 
  maxLng: 11.98,  
};

const MOROCCO_EXCLUSION = {
  minLat: 27.0,
  maxLat: 36.0,
  minLng: -17.0,
  maxLng: -1.0,
};

const TUNISIA_EXCLUSION = {
  minLat: 30.2,
  maxLat: 37.6,
  minLng: 7.5,
  maxLng: 11.98,
};

const LIBYA_EXCLUSION = {
  minLat: 19.5,
  maxLat: 33.2,
  minLng: 11.0,
  maxLng: 25.0,
};

const MALI_NIGER_EXCLUSION = {
  minLat: 10.0,
  maxLat: 20.0,
  minLng: -8.67,
  maxLng: 11.98,
};

const WESTERN_SAHARA_EXCLUSION = {
  minLat: 20.0,
  maxLat: 27.7,
  minLng: -17.0,
  maxLng: -8.67,
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

  if (
    latitude >= MOROCCO_EXCLUSION.minLat &&
    latitude <= MOROCCO_EXCLUSION.maxLat &&
    longitude >= MOROCCO_EXCLUSION.minLng &&
    longitude <= MOROCCO_EXCLUSION.maxLng
  ) {
    console.log('❌ Zone Maroc détectée');
    return false;
  }

  if (
    latitude >= TUNISIA_EXCLUSION.minLat &&
    latitude <= TUNISIA_EXCLUSION.maxLat &&
    longitude >= TUNISIA_EXCLUSION.minLng &&
    longitude <= TUNISIA_EXCLUSION.maxLng
  ) {
    if (longitude >= 8.0 && latitude >= 32.0) {
      console.log('❌ Zone Tunisie détectée');
      return false;
    }
  }

  if (longitude >= LIBYA_EXCLUSION.minLng) {
    console.log('❌ Zone Libye détectée (lng >= 11.0°)');
    return false;
  }

  if (
    latitude >= MALI_NIGER_EXCLUSION.minLat &&
    latitude <= MALI_NIGER_EXCLUSION.maxLat &&
    latitude < 20.5
  ) {
    console.log('❌ Zone Mali/Niger détectée');
    return false;
  }

  if (
    latitude >= WESTERN_SAHARA_EXCLUSION.minLat &&
    latitude <= WESTERN_SAHARA_EXCLUSION.maxLat &&
    longitude >= WESTERN_SAHARA_EXCLUSION.minLng &&
    longitude < -8.0
  ) {
    console.log('❌ Zone Sahara Occidental détectée');
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

  if (
    latitude >= MOROCCO_EXCLUSION.minLat &&
    latitude <= MOROCCO_EXCLUSION.maxLat &&
    longitude >= MOROCCO_EXCLUSION.minLng &&
    longitude <= MOROCCO_EXCLUSION.maxLng
  ) {
    return "Maroc 🇲🇦";
  }

  if (
    latitude >= TUNISIA_EXCLUSION.minLat &&
    latitude <= TUNISIA_EXCLUSION.maxLat &&
    longitude >= TUNISIA_EXCLUSION.minLng &&
    longitude <= TUNISIA_EXCLUSION.maxLng
  ) {
    return "Tunisie 🇹🇳";
  }

  if (longitude >= LIBYA_EXCLUSION.minLng) {
    return "Libye 🇱🇾";
  }

  if (latitude < 20.5) {
    return "Mali/Niger 🇲🇱🇳🇪";
  }

  if (longitude < -8.0 && latitude < 27.7) {
    return "Sahara Occidental";
  }

  return "Hors Algérie";
}

export function getAlgeriaBounds() {
  return ALGERIA_BOUNDS;
}

export function testCoordinates() {
  const tests = [
    { name: "Alger", lat: 36.7538, lng: 3.0588 },
    { name: "Oran", lat: 35.6969, lng: -0.6331 },
    { name: "Constantine", lat: 36.3650, lng: 6.6147 },
    { name: "Tlemcen (frontière Maroc)", lat: 34.8780, lng: -1.3157 },
    { name: "Annaba (frontière Tunisie)", lat: 36.9000, lng: 7.7667 },
    { name: "Tamanrasset (sud)", lat: 22.7850, lng: 5.5228 },
    { name: "Casablanca (Maroc)", lat: 33.5731, lng: -7.5898 },
    { name: "Tunis (Tunisie)", lat: 36.8065, lng: 10.1815 },
    { name: "Sfax (Tunisie)", lat: 34.7406, lng: 10.7603 },
    { name: "Tripoli (Libye)", lat: 32.8872, lng: 13.1913 },
    { name: "Bamako (Mali)", lat: 12.6392, lng: -8.0029 },
  ];

  console.log('\n🧪 Test de validation géographique:\n');
  tests.forEach(test => {
    const result = isInAlgeria({ latitude: test.lat, longitude: test.lng });
    console.log(`${result ? '✅' : '❌'} ${test.name}: ${test.lat}, ${test.lng}`);
  });
}