/**
 * Geovalidation.js
 * Validation géographique basée sur un polygone précis des frontières de l'Algérie.
 * Utilise l'algorithme Ray Casting pour déterminer si un point est dans le polygone.
 */

const ALGERIA_POLYGON = [
  // ── Nord-Ouest : frontière Maroc ──────────────────────────────────────────
  { lat: 35.1717, lng: -2.2170 },
  { lat: 34.8780, lng: -1.7924 },
  { lat: 34.0000, lng: -1.6000 },
  { lat: 33.2000, lng: -1.6500 },
  { lat: 32.0800, lng: -1.2500 },
  { lat: 30.0000, lng: -2.0000 },
  { lat: 29.0000, lng: -1.2500 },

  // ── Ouest : frontière Mauritanie ─────────────────────────────────────────
  { lat: 27.6577, lng: -8.6670 },
  { lat: 24.9945, lng: -8.6670 },

  // ── Sud-Ouest : frontière Mali (diagonale précise) ────────────────────────
  // Tripoint Algérie-Mauritanie-Mali (~24.99°N, -8.67°E)
  // → descend en diagonale vers tripoint Algérie-Mali-Mauritanie (~21.33°N, -4.83°E)
  { lat: 23.4728, lng: -5.9000 },
  { lat: 21.8000, lng: -5.2000 },
  { lat: 21.3307, lng: -4.8300 }, // tripoint Algérie-Mali-Mauritanie

  // ── Sud : frontière Mali (diagonale vers tripoint Mali-Niger) ─────────────
  // La frontière monte légèrement puis descend vers 19.167°N
  // Cette diagonale est la clé — elle exclut Kidal et la zone lat ~20-21, lng 0-3
  { lat: 21.0000, lng: -3.5000 },
  { lat: 20.4000, lng: -2.0000 },
  { lat: 19.8000, lng: -0.5000 },
  { lat: 19.4000, lng:  1.5000 },
  { lat: 19.1670, lng:  3.1670 }, // tripoint officiel Algérie-Mali-Niger

  // ── Sud : frontière Niger ─────────────────────────────────────────────────
  // Monte de 19.167°N vers In Guezzam puis nord-est vers la Libye
  { lat: 19.4000, lng:  4.0000 },
  { lat: 19.5700, lng:  5.7700 }, // In Guezzam (ville frontière)
  { lat: 20.0000, lng:  6.5000 },
  { lat: 20.5000, lng:  7.5000 },
  { lat: 21.0000, lng:  8.5000 },
  { lat: 21.8000, lng:  9.0000 },
  { lat: 22.5000, lng:  9.3800 },

  // ── Sud-Est : frontière Niger / Libye ─────────────────────────────────────
  { lat: 23.9000, lng:  9.5500 },
  { lat: 24.9500, lng: 11.5600 },
  { lat: 25.0000, lng: 11.9800 },

  // ── Est : frontière Libye ─────────────────────────────────────────────────
  { lat: 26.5000, lng: 11.9800 },
  { lat: 30.4000, lng: 11.9800 },

  // ── Nord-Est : frontière Tunisie ──────────────────────────────────────────
  { lat: 33.1400, lng: 11.5000 },
  { lat: 33.1700, lng:  8.4300 },
  { lat: 36.4670, lng:  8.2250 },
  { lat: 37.0930, lng:  8.5730 },

  // ── Nord : côte méditerranéenne ───────────────────────────────────────────
  { lat: 37.0900, lng:  8.6000 },
  { lat: 37.1100, lng:  5.1000 },
  { lat: 36.9400, lng:  3.0600 },
  { lat: 35.8500, lng:  0.2200 },
  { lat: 35.7500, lng: -0.7300 },
  { lat: 35.3500, lng: -1.2000 },
  { lat: 35.1717, lng: -2.2170 }, // retour point de départ
];

/**
 * Algorithme Ray Casting.
 * Lance un rayon horizontal depuis le point et compte les intersections
 * avec les arêtes du polygone. Nombre impair = point à l'intérieur.
 */
function isPointInPolygon(lat, lng, polygon) {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Vérifie si une coordonnée est en Algérie.
 */
export function isInAlgeria(location) {
  if (!location || location.latitude == null || location.longitude == null) {
    return false;
  }

  const { latitude, longitude } = location;

  // Bounding box rapide avant le test polygone (optimisation)
  if (
    latitude  < 18.96 || latitude  > 37.20 ||
    longitude < -8.67 || longitude > 11.98
  ) {
    console.log('❌ Hors bounding box Algérie');
    return false;
  }

  const result = isPointInPolygon(latitude, longitude, ALGERIA_POLYGON);

  if (result) {
    console.log('✅ Coordonnée en Algérie:', latitude, longitude);
  } else {
    console.log('❌ Hors Algérie (polygone):', latitude, longitude);
  }

  return result;
}

/**
 * Valide que les deux points (départ + destination) sont en Algérie.
 */
export function validateLocationsInAlgeria(start, end) {
  console.log('🔍 Validation géographique:');
  console.log('  Départ:', start);
  console.log('  Destination:', end);

  const startInAlgeria = isInAlgeria(start);
  const endInAlgeria   = isInAlgeria(end);

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

/**
 * Retourne le nom du pays approximatif pour un point donné.
 */
export function getApproximateCountry(location) {
  if (!location) return "Inconnu";
  if (isInAlgeria(location)) return "Algérie 🇩🇿";

  const { latitude, longitude } = location;

  if (longitude < -1.0  && latitude > 27.0 && latitude < 36.0) return "Maroc 🇲🇦";
  if (longitude > 7.5   && latitude > 30.2 && latitude < 37.6) return "Tunisie 🇹🇳";
  if (longitude > 11.5  && latitude > 19.5 && latitude < 33.2) return "Libye 🇱🇾";
  if (latitude  < 20.0)                                         return "Mali / Niger 🇲🇱🇳🇪";

  return "Hors Algérie";
}

/**
 * Retourne la bounding box de l'Algérie.
 */
export function getAlgeriaBounds() {
  return { minLat: 18.96, maxLat: 37.20, minLng: -8.67, maxLng: 11.98 };
}

/**
 * Série de tests pour vérifier la validation.
 * Appelle cette fonction au démarrage en dev pour valider le polygone.
 */
export function testCoordinates() {
  const tests = [
    // ✅ En Algérie
    { name: "Alger",                          lat: 36.7538,  lng:  3.0588,  expected: true  },
    { name: "Oran",                           lat: 35.6969,  lng: -0.6331,  expected: true  },
    { name: "Constantine",                    lat: 36.3650,  lng:  6.6147,  expected: true  },
    { name: "Tamanrasset",                    lat: 22.7850,  lng:  5.5228,  expected: true  },
    { name: "Adrar",                          lat: 27.8742,  lng: -0.2939,  expected: true  },
    { name: "Djanet",                         lat: 24.5550,  lng:  9.4848,  expected: true  },
    { name: "Tindouf",                        lat: 27.6740,  lng: -8.1470,  expected: true  },
    { name: "In Salah",                       lat: 27.1960,  lng:  2.4720,  expected: true  },
    { name: "In Guezzam (frontière Niger)",   lat: 19.5700,  lng:  5.7700,  expected: true  },
    { name: "Bordj Badji Mokhtar",            lat: 21.3310,  lng: -0.9540,  expected: true  },
    // ❌ Hors Algérie
    { name: "Casablanca (Maroc)",             lat: 33.5731,  lng: -7.5898,  expected: false },
    { name: "Tunis (Tunisie)",                lat: 36.8065,  lng: 10.1815,  expected: false },
    { name: "Sfax (Tunisie)",                 lat: 34.7406,  lng: 10.7603,  expected: false },
    { name: "Tripoli (Libye)",                lat: 32.8872,  lng: 13.1913,  expected: false },
    { name: "Bamako (Mali)",                  lat: 12.6392,  lng: -8.0029,  expected: false },
    { name: "Kidal (Mali)",                   lat: 18.4400,  lng:  1.4100,  expected: false },
    { name: "Taoudénit (Mali)",               lat: 21.1789,  lng:  9.7996,  expected: false },
    { name: "Agadez (Niger)",                 lat: 20.1816,  lng:  9.0835,  expected: false },
    { name: "Coords Mali lat20.59 lng0.55",   lat: 20.5897,  lng:  0.5485,  expected: false },
    { name: "Coords Niger lat22.02 lng-0.97", lat: 22.0198,  lng: -0.9693,  expected: false },
  ];

  console.log('\n🧪 Test de validation géographique:\n');
  let passed = 0;
  tests.forEach(test => {
    const result = isInAlgeria({ latitude: test.lat, longitude: test.lng });
    const ok = result === test.expected;
    if (ok) passed++;
    console.log(
      `${ok ? '✅' : '❌ FAIL'} ${test.name}: got ${result}, expected ${test.expected}`
    );
  });
  console.log(`\n📊 ${passed}/${tests.length} tests passed`);
}