// ── Wilaya map (code plaque → nom + coords centre) ────────────────────────────
const WILAYA_MAP = {
  "01": { nom: "Adrar",           lat: 27.8741, lng: 0.2842  },
  "02": { nom: "Chlef",           lat: 36.1650, lng: 1.3317  },
  "03": { nom: "Laghouat",        lat: 33.8000, lng: 2.8652  },
  "04": { nom: "Oum El Bouaghi",  lat: 35.8692, lng: 7.1131  },
  "05": { nom: "Batna",           lat: 35.5559, lng: 6.1741  },
  "06": { nom: "Béjaïa",          lat: 36.7509, lng: 5.0567  },
  "07": { nom: "Biskra",          lat: 34.8500, lng: 5.7333  },
  "08": { nom: "Béchar",          lat: 31.6238, lng: -2.2164 },
  "09": { nom: "Blida",           lat: 36.4703, lng: 2.8277  },
  "10": { nom: "Bouira",          lat: 36.3700, lng: 3.9000  },
  "11": { nom: "Tamanrasset",     lat: 22.7851, lng: 5.5228  },
  "12": { nom: "Tébessa",         lat: 35.4000, lng: 8.1167  },
  "13": { nom: "Tlemcen",         lat: 34.8828, lng: -1.3167 },
  "14": { nom: "Tiaret",          lat: 35.3706, lng: 1.3217  },
  "15": { nom: "Tizi Ouzou",      lat: 36.7169, lng: 4.0497  },
  "16": { nom: "Alger",           lat: 36.7538, lng: 3.0588  },
  "17": { nom: "Djelfa",          lat: 34.6736, lng: 3.2631  },
  "18": { nom: "Jijel",           lat: 36.8200, lng: 5.7667  },
  "19": { nom: "Sétif",           lat: 36.1898, lng: 5.4108  },
  "20": { nom: "Saïda",           lat: 34.8300, lng: 0.1500  },
  "21": { nom: "Skikda",          lat: 36.8760, lng: 6.9000  },
  "22": { nom: "Sidi Bel Abbès",  lat: 35.2000, lng: -0.6333 },
  "23": { nom: "Annaba",          lat: 36.9000, lng: 7.7667  },
  "24": { nom: "Guelma",          lat: 36.4639, lng: 7.4317  },
  "25": { nom: "Constantine",     lat: 36.3650, lng: 6.6147  },
  "26": { nom: "Médéa",           lat: 36.2638, lng: 2.7539  },
  "27": { nom: "Mostaganem",      lat: 35.9333, lng: 0.0833  },
  "28": { nom: "M'Sila",          lat: 35.7058, lng: 4.5417  },
  "29": { nom: "Mascara",         lat: 35.3956, lng: 0.1403  },
  "30": { nom: "Ouargla",         lat: 31.9539, lng: 5.3239  },
  "31": { nom: "Oran",            lat: 35.6969, lng: -0.6331 },
  "32": { nom: "El Bayadh",       lat: 33.6833, lng: 1.0167  },
  "33": { nom: "Illizi",          lat: 26.5000, lng: 8.4833  },
  "34": { nom: "Bordj Bou Arréridj", lat: 36.0731, lng: 4.7631 },
  "35": { nom: "Boumerdès",       lat: 36.7667, lng: 3.4667  },
  "36": { nom: "El Tarf",         lat: 36.7672, lng: 8.3133  },
  "37": { nom: "Tindouf",         lat: 27.6667, lng: -8.1500 },
  "38": { nom: "Tissemsilt",      lat: 35.6078, lng: 1.8117  },
  "39": { nom: "El Oued",         lat: 33.3667, lng: 6.8500  },
  "40": { nom: "Khenchela",       lat: 35.4353, lng: 7.1428  },
  "41": { nom: "Souk Ahras",      lat: 36.2869, lng: 7.9514  },
  "42": { nom: "Tipaza",          lat: 36.5894, lng: 2.4469  },
  "43": { nom: "Mila",            lat: 36.4500, lng: 6.2667  },
  "44": { nom: "Aïn Defla",       lat: 36.2564, lng: 1.9658  },
  "45": { nom: "Naâma",           lat: 33.2667, lng: -0.3167 },
  "46": { nom: "Aïn Témouchent",  lat: 35.2983, lng: -1.1406 },
  "47": { nom: "Ghardaïa",        lat: 32.4833, lng: 3.6667  },
  "48": { nom: "Relizane",        lat: 35.7333, lng: 0.5667  },
  "49": { nom: "Timimoun",        lat: 29.2639, lng: 0.2306  },
  "50": { nom: "Bordj Badji Mokhtar", lat: 21.3269, lng: 0.9456 },
  "51": { nom: "Ouled Djellal",   lat: 34.4178, lng: 5.0664  },
  "52": { nom: "Béni Abbès",      lat: 30.1281, lng: -2.1644 },
  "53": { nom: "In Salah",        lat: 27.1978, lng: 2.4806  },
  "54": { nom: "In Guezzam",      lat: 19.5667, lng: 5.7667  },
  "55": { nom: "Touggourt",       lat: 33.1000, lng: 6.0667  },
  "56": { nom: "Djanet",          lat: 24.5553, lng: 9.4844  },
  "57": { nom: "El M'Ghair",      lat: 33.9500, lng: 5.9333  },
  "58": { nom: "El Meniaa",       lat: 30.5833, lng: 2.8833  },
};


const extractWilayaFromPlaque = (plaque) => {
  if (!plaque) return null;
  const cleaned = plaque.replace(/[\s\-\.]/g, "");
  // Les 2 derniers chiffres = code wilaya
  const code = cleaned.slice(-2).padStart(2, "0");
  return WILAYA_MAP[code] ? { code, ...WILAYA_MAP[code] } : null;
};

export { WILAYA_MAP, extractWilayaFromPlaque };