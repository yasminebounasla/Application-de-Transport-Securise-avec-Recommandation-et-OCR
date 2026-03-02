
const TARIF = {
  base:      5,  
  par_km:    38, 
  par_min:    7,  
  minimum:  100,  
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