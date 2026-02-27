// utils/priceCalculator.js

const TARIF = {
  base:     150,  // DA — montant fixe de départ
  par_km:    38,  // DA par kilomètre
  par_min:    7,  // DA par minute
  minimum:  250,  // DA — prix plancher
};

/**
 * @param {number} distanceKm  Distance en kilomètres  (ex: data.distanceKm)
 * @param {number} durationMin Durée en minutes        (ex: data.durationMin)
 * @returns {{ price: number, breakdown: { base: number, distanceCost: number, durationCost: number } }}
 */
export function calculatePrice(distanceKm, durationMin) {
  const distanceCost = distanceKm  * TARIF.par_km;
  const durationCost = durationMin * TARIF.par_min;
  const raw          = TARIF.base + distanceCost + durationCost;
  const price        = Math.max(TARIF.minimum, Math.round(raw / 10) * 10);

  return {
    price,
    breakdown: {
      base:         TARIF.base,
      distanceCost: Math.round(distanceCost),
      durationCost: Math.round(durationCost),
    },
  };
}