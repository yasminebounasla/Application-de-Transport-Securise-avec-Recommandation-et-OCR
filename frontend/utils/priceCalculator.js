const TARIF = {
  base:     100,
  par_km:    12,
  par_min:    2,
  minimum:  200,
};

const SUPPLEMENTS = {
  luggage_large:      { label: "Large bags",     amount: 200 },
  pets_ok:            { label: "Pets",           amount: 150 },
  female_driver_pref: { label: "Female driver",  amount: 300 },
};

export function calculatePrice(distanceKm, durationMin, preferences = {}) {
  const distanceCost = distanceKm * TARIF.par_km;
  const durationCost = durationMin * TARIF.par_min;

  const supplements = Object.entries(SUPPLEMENTS)
    .filter(([key]) => preferences[key] === "yes")
    .map(([key, { label, amount }]) => ({ key, label, amount }));

  const supplementTotal = supplements.reduce((sum, s) => sum + s.amount, 0);

  const raw   = TARIF.base + distanceCost + durationCost + supplementTotal;
  const price = Math.max(TARIF.minimum, Math.round(raw / 10) * 10);

  return {
    price,
    breakdown: {
      base:          TARIF.base,
      distanceCost:  Math.round(distanceCost),
      durationCost:  Math.round(durationCost),
      supplements,
      supplementTotal,
    },
  };
}