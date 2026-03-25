// seed.trajets.js
// FIX : chaque passager fait des trajets avec une MIX de drivers
//   - 60% bons matchs (drivers compatibles avec son profil)  → notes hautes
//   - 25% matchs moyens                                      → notes moyennes
//   - 15% mauvais matchs (drivers incompatibles)             → notes basses / annulation
// Cela donne une distribution de weights utilisable pour LightFM

import { prisma } from "../config/prisma.js";

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt    = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ── PROFILS PASSAGERS ─────────────────────────────────────────────────────────
const PASSENGER_PROFILES = [
  {
    type: "calme",
    prefs: () => ({
      quiet_ride: "yes", radio_ok: "no", smoking_ok: "no",
      pets_ok: "no", luggage_large: Math.random() > 0.5 ? "yes" : "no",
      female_driver_pref: "no",
    }),
  },
  {
    type: "social",
    prefs: () => ({
      quiet_ride: "no", radio_ok: "yes",
      smoking_ok: Math.random() > 0.5 ? "yes" : "no",
      pets_ok: "yes", luggage_large: "no", female_driver_pref: "no",
    }),
  },
  {
    type: "female_pref",
    prefs: () => ({
      quiet_ride: Math.random() > 0.5 ? "yes" : "no",
      radio_ok: Math.random() > 0.5 ? "yes" : "no",
      smoking_ok: "no", pets_ok: "no", luggage_large: "no",
      female_driver_pref: "yes",
    }),
  },
  {
    type: "luggage",
    prefs: () => ({
      quiet_ride: "yes", radio_ok: "no", smoking_ok: "no",
      pets_ok: "no", luggage_large: "yes", female_driver_pref: "no",
    }),
  },
];

function getProfile(passengerId) {
  const r = (passengerId * 7 + 13) % 100;
  if (r < 40) return PASSENGER_PROFILES[0];
  if (r < 65) return PASSENGER_PROFILES[1];
  if (r < 85) return PASSENGER_PROFILES[2];
  return PASSENGER_PROFILES[3];
}

// ── MATCHSCORE (total fixe = 11) ──────────────────────────────────────────────
function matchScore(prefs, driver) {
  let score = 0;

  if      (prefs.quiet_ride === "yes" && !driver.talkative) score += 3;
  else if (prefs.quiet_ride === "no"  &&  driver.talkative) score += 3;

  const tRadio = prefs.radio_ok;
  const dRadio = driver.radio_on ? "yes" : "no";
  if (tRadio === dRadio) score += 1;

  if      (prefs.smoking_ok === "yes" &&  driver.smoking_allowed) score += 2;
  else if (prefs.smoking_ok === "no"  && !driver.smoking_allowed) score += 2;

  if      (prefs.pets_ok === "yes" &&  driver.pets_allowed) score += 2;
  else if (prefs.pets_ok === "no"  && !driver.pets_allowed) score += 2;

  if      (prefs.luggage_large === "yes" &&  driver.car_big) score += 2;
  else if (prefs.luggage_large === "no"  && !driver.car_big) score += 2;

  if      (prefs.female_driver_pref === "yes" && driver.sexe === "F") score += 1;
  else if (prefs.female_driver_pref === "no"  && driver.sexe === "M") score += 1;

  return score / 11;
}

// ── SEED ──────────────────────────────────────────────────────────────────────
async function seedTrajets() {
  const passengers = await prisma.passenger.findMany();
  const drivers    = await prisma.driver.findMany();

  console.log(`📊 Passengers : ${passengers.length}`);
  console.log(`📊 Drivers    : ${drivers.length}`);

  if (!passengers.length || !drivers.length) {
    console.error("❌ Lance d'abord seedPassengers et seedDrivers !");
    process.exit(1);
  }

  console.log("\n🗑️  Nettoyage...");
  await prisma.evaluation.deleteMany({});
  await prisma.trajet.deleteMany({});
  console.log("✅ Nettoyé\n");

  const CITY_POINTS = {
    "Alger Centre":       { lat: 36.7538, lng: 3.0588,  address: "Alger Centre, Alger, Algeria" },
    "Oran Ville":         { lat: 35.6971, lng: -0.6308, address: "Oran Ville, Oran, Algeria" },
    "Constantine Centre": { lat: 36.3650, lng: 6.6147,  address: "Constantine Centre, Constantine, Algeria" },
    "Annaba Ville":       { lat: 36.9000, lng: 7.7667,  address: "Annaba Ville, Annaba, Algeria" },
    "Sétif Ville":        { lat: 36.1911, lng: 5.4137,  address: "Sétif Ville, Sétif, Algeria" },
    "Blida Centre":       { lat: 36.4700, lng: 2.8277,  address: "Blida Centre, Blida, Algeria" },
    "Tizi Ouzou":         { lat: 36.7169, lng: 4.0497,  address: "Tizi Ouzou, Tizi Ouzou, Algeria" },
    "Béjaïa Centre":      { lat: 36.7509, lng: 5.0567,  address: "Béjaïa Centre, Béjaïa, Algeria" },
    "Médéa Ville":        { lat: 36.2642, lng: 2.7583,  address: "Médéa Ville, Médéa, Algeria" },
    "Boumerdès":          { lat: 36.7664, lng: 3.4772,  address: "Boumerdès, Boumerdès, Algeria" },
  };
  const VILLES_DEP = Object.keys(CITY_POINTS).slice(0, 5);
  const VILLES_ARR = Object.keys(CITY_POINTS).slice(5);

  let totalTrajets = 0;
  let totalEvals   = 0;

  for (const passenger of passengers) {
    const profile  = getProfile(passenger.id);
    const nbTrajets = randomInt(10, 18); // plus de trajets par passager

    // ── Scorer tous les drivers pour ce profil passager ──────────────────────
    const scored = drivers
      .map((d) => ({ driver: d, score: matchScore(profile.prefs(), d) }))
      .sort((a, b) => b.score - a.score);

    // Partitionner : top 40% = bons, milieu 35% = moyens, bas 25% = mauvais
    const cutGood = Math.floor(drivers.length * 0.40);
    const cutMid  = Math.floor(drivers.length * 0.75);
    const goodDrivers = scored.slice(0, cutGood).map((s) => s.driver);
    const midDrivers  = scored.slice(cutGood, cutMid).map((s) => s.driver);
    const badDrivers  = scored.slice(cutMid).map((s) => s.driver);

    // Distribuer les trajets : 60% good, 25% mid, 15% bad
    const nGood = Math.round(nbTrajets * 0.60);
    const nMid  = Math.round(nbTrajets * 0.25);
    const nBad  = nbTrajets - nGood - nMid;

    const picks = [
      ...goodDrivers.sort(() => 0.5 - Math.random()).slice(0, nGood),
      ...midDrivers.sort(() => 0.5 - Math.random()).slice(0, nMid),
      ...badDrivers.sort(() => 0.5 - Math.random()).slice(0, nBad),
    ];

    for (const driver of picks) {
      const prefs = profile.prefs();
      const ms    = matchScore(prefs, driver);

      // Status basé sur le match
      let status;
      const r = Math.random();
      if      (ms > 0.70) status = r < 0.90 ? "COMPLETED" : "CANCELLED_BY_PASSENGER";
      else if (ms > 0.45) status = r < 0.70 ? "COMPLETED" : r < 0.90 ? "CANCELLED_BY_PASSENGER" : "PENDING";
      else                status = r < 0.40 ? "COMPLETED" : r < 0.85 ? "CANCELLED_BY_PASSENGER" : "PENDING";

      // Rating basé sur le match (signal fort, bruit minimal)
      let rating = null;
      if (status === "COMPLETED") {
        const base  = ms * 3.5 + 1.5;              // [1.5 .. 5.0]
        const noise = (Math.random() - 0.5) * 0.6; // bruit ±0.3 (réduit vs avant)
        rating = parseFloat(Math.max(1.0, Math.min(5.0, base + noise)).toFixed(1));
      }

      const depart      = randomChoice(VILLES_DEP);
      const destination = randomChoice(VILLES_ARR);
      const dp          = CITY_POINTS[depart];
      const da          = CITY_POINTS[destination];

      try {
        const trajet = await prisma.trajet.create({
          data: {
            driverId:     driver.id,
            passagerId:   passenger.id,
            depart,
            destination,
            startLat:     dp?.lat ?? null,
            startLng:     dp?.lng ?? null,
            startAddress: dp?.address ?? depart,
            endLat:       da?.lat ?? null,
            endLng:       da?.lng ?? null,
            endAddress:   da?.address ?? destination,
            dateDepart:   new Date(Date.now() - randomInt(1, 120) * 86400000),
            heureDepart:  `${randomInt(6, 22)}:${randomChoice(["00", "15", "30", "45"])}`,
            placesDispo:  randomInt(1, 4),
            prix:         parseFloat(randomInt(300, 2500).toFixed(2)),
            status,
            quiet_ride:         prefs.quiet_ride,
            radio_ok:           prefs.radio_ok,
            smoking_ok:         prefs.smoking_ok,
            pets_ok:            prefs.pets_ok,
            luggage_large:      prefs.luggage_large,
            female_driver_pref: prefs.female_driver_pref,
          },
        });

        totalTrajets++;

        if (status === "COMPLETED" && rating !== null) {
          await prisma.evaluation.create({
            data: { trajetId: trajet.id, rating },
          });
          totalEvals++;
        }
      } catch (e) {
        console.error(`❌ (p${passenger.id}, d${driver.id}): ${e.message}`);
      }
    }
  }

  console.log(`✅ ${totalTrajets} trajets créés`);
  console.log(`✅ ${totalEvals} évaluations créées`);

  // Mettre à jour avgRating
  console.log("\n📊 Mise à jour avgRating...");
  for (const driver of drivers) {
    const evals = await prisma.evaluation.findMany({
      where: { trajet: { driverId: driver.id } },
    });
    if (evals.length > 0) {
      const avg = evals.reduce((s, e) => s + e.rating, 0) / evals.length;
      await prisma.driver.update({
        where: { id: driver.id },
        data:  { avgRating: parseFloat(avg.toFixed(2)), ratingsCount: evals.length },
      });
    }
  }
  console.log("✅ avgRating mis à jour");

  // Diagnostic de la distribution
  console.log("\n📈 Distribution des ratings créés :");
  const evals = await prisma.evaluation.findMany();
  const dist  = { "4.5-5": 0, "3.5-4.4": 0, "2.5-3.4": 0, "<2.5": 0 };
  evals.forEach((e) => {
    if      (e.rating >= 4.5) dist["4.5-5"]++;
    else if (e.rating >= 3.5) dist["3.5-4.4"]++;
    else if (e.rating >= 2.5) dist["2.5-3.4"]++;
    else                      dist["<2.5"]++;
  });
  console.log(`   4.5–5.0 : ${dist["4.5-5"]}  (weight ≥ 0.875)`);
  console.log(`   3.5–4.4 : ${dist["3.5-4.4"]} (weight 0.625–0.85)`);
  console.log(`   2.5–3.4 : ${dist["2.5-3.4"]} (weight 0.375–0.6)`);
  console.log(`   < 2.5   : ${dist["<2.5"]}   (weight < 0.375)`);

  await prisma.$disconnect();
}

seedTrajets().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});