const TARIF = {
  base:     100,
  par_km:    12,
  par_min:    2,
  minimum:  200,
};

export function calculatePrice(distanceKm, durationMin) {
  const distanceCost = distanceKm * TARIF.par_km;
  const durationCost = durationMin * TARIF.par_min;
  const raw = TARIF.base + distanceCost + durationCost;
  const price = Math.max(TARIF.minimum, Math.round(raw / 10) * 10);

  return {
    price,
    breakdown: {
      base: TARIF.base,
      distanceCost: Math.round(distanceCost),
      durationCost: Math.round(durationCost),
    },
  };
}