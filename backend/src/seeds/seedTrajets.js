// seed.trajets.js
import { prisma } from "../config/prisma.js";
import axios from "axios";

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

// ── HAVERSINE ─────────────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── SCORES ────────────────────────────────────────────────────────────────────
function matchScore(prefs, driver) {
  let score = 0;
  if      (prefs.quiet_ride === "yes" && !driver.talkative) score += 3;
  else if (prefs.quiet_ride === "no"  &&  driver.talkative) score += 3;
  if (prefs.radio_ok === (driver.radio_on ? "yes" : "no"))  score += 1;
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

function workHourMatch(driver, hour) {
  if (hour >= 5  && hour < 12  && driver.works_morning)   return 1;
  if (hour >= 12 && hour < 18  && driver.works_afternoon) return 1;
  if (hour >= 18 && hour < 22  && driver.works_evening)   return 1;
  if ((hour >= 22 || hour < 5) && driver.works_night)     return 1;
  return 0;
}

function scoreDistance(distanceKm) {
  return parseFloat((1 / (1 + distanceKm / 80)).toFixed(4));
}

// ── LIGHTFM PROXY ─────────────────────────────────────────────────────────────
// Simule ce que LightFM apprendrait réellement :
// combinaison de pref + rating + work avec léger bruit pour variance réaliste
function lightfmProxy(pref, ratingScore, workScore) {
  const raw   = 0.45 * pref + 0.35 * ratingScore + 0.20 * workScore;
  const noise = (Math.random() - 0.5) * 0.10;
  return parseFloat(Math.max(0.0, Math.min(1.0, raw + noise)).toFixed(4));
}

// ── MLSCORES ──────────────────────────────────────────────────────────────────
function buildMlScores(prefs, driver, heureDepart, distKm) {
  const pref   = parseFloat(matchScore(prefs, driver).toFixed(4));
  const rating = parseFloat((((driver.avgRating || 4.0) - 1) / 4).toFixed(4));

  let work = 0;
  if (heureDepart) {
    const hour = parseInt(heureDepart.split(":")[0], 10);
    work = workHourMatch(driver, hour);
  }

  const dist    = distKm !== null ? scoreDistance(distKm) : null;
  const lightfm = lightfmProxy(pref, rating, work);

  return { lightfm, pref, dist, work, rating };
}

// ── FEEDBACK FASTAPI ──────────────────────────────────────────────────────────
async function sendFeedbackToFastAPI(rating, scores) {
  try {
    const cleanScores = Object.fromEntries(
      Object.entries(scores).filter(([_, v]) => v !== null)
    );
    if (!cleanScores.pref) return;
    await axios.post(
      `${process.env.ML_SERVICE_URL || "http://localhost:8000"}/feedback`,
      { rating, scores: cleanScores },
      { timeout: 3000 }
    );
  } catch {
    // silencieux si FastAPI pas lancé
  }
}

// ── GÉOGRAPHIE ───────────────────────────────────────────────────────────────
// Alger — points intra-wilaya
const ALGER_POINTS = [
  { name: "Alger Centre",    lat: 36.7538, lng: 3.0588, address: "Alger Centre, Alger" },
  { name: "Bab El Oued",     lat: 36.7731, lng: 3.0497, address: "Bab El Oued, Alger" },
  { name: "El Harrach",      lat: 36.7167, lng: 3.1333, address: "El Harrach, Alger" },
  { name: "Kouba",           lat: 36.7272, lng: 3.1606, address: "Kouba, Alger" },
  { name: "Dar El Beida",    lat: 36.7197, lng: 3.2150, address: "Dar El Beida, Alger" },
  { name: "Draria",          lat: 36.7069, lng: 3.0000, address: "Draria, Alger" },
  { name: "Birtouta",        lat: 36.6700, lng: 2.9833, address: "Birtouta, Alger" },
  { name: "Hydra",           lat: 36.7456, lng: 3.0231, address: "Hydra, Alger" },
  { name: "Birkhadem",       lat: 36.7167, lng: 3.0500, address: "Birkhadem, Alger" },
  { name: "Hussein Dey",     lat: 36.7378, lng: 3.1108, address: "Hussein Dey, Alger" },
  { name: "Bourouba",        lat: 36.7069, lng: 3.1514, address: "Bourouba, Alger" },
  { name: "Saoula",          lat: 36.6833, lng: 3.0167, address: "Saoula, Alger" },
  { name: "Bouzareah",       lat: 36.7667, lng: 2.9667, address: "Bouzareah, Alger" },
  { name: "Cheraga",         lat: 36.7631, lng: 2.9997, address: "Cheraga, Alger" },
  { name: "Bordj El Kiffan", lat: 36.7333, lng: 3.2833, address: "Bordj El Kiffan, Alger" },
  { name: "Reghaia",         lat: 36.7167, lng: 3.3500, address: "Reghaia, Alger" },
  { name: "Zeralda",         lat: 36.7500, lng: 2.8833, address: "Zeralda, Alger" },
  { name: "Staoueli",        lat: 36.7500, lng: 2.8500, address: "Staoueli, Alger" },
];

// Autres wilayas
const AUTRES_POINTS = [
  { name: "Oran Ville",         lat: 35.6971, lng: -0.6308, address: "Oran Ville, Oran",                wilaya: "Oran" },
  { name: "Constantine Centre", lat: 36.3650, lng: 6.6147,  address: "Constantine Centre, Constantine", wilaya: "Constantine" },
  { name: "Annaba Ville",       lat: 36.9000, lng: 7.7667,  address: "Annaba Ville, Annaba",            wilaya: "Annaba" },
  { name: "Sétif Ville",        lat: 36.1911, lng: 5.4137,  address: "Sétif Ville, Sétif",              wilaya: "Sétif" },
  { name: "Blida Centre",       lat: 36.4700, lng: 2.8277,  address: "Blida Centre, Blida",             wilaya: "Blida" },
  { name: "Tizi Ouzou",         lat: 36.7169, lng: 4.0497,  address: "Tizi Ouzou, Tizi Ouzou",          wilaya: "Tizi Ouzou" },
  { name: "Béjaïa Centre",      lat: 36.7509, lng: 5.0567,  address: "Béjaïa Centre, Béjaïa",          wilaya: "Béjaïa" },
  { name: "Médéa Ville",        lat: 36.2642, lng: 2.7583,  address: "Médéa Ville, Médéa",              wilaya: "Médéa" },
  { name: "Boumerdès",          lat: 36.7664, lng: 3.4772,  address: "Boumerdès, Boumerdès",            wilaya: "Boumerdès" },
  { name: "Tipaza",             lat: 36.5897, lng: 2.4477,  address: "Tipaza, Tipaza",                  wilaya: "Tipaza" },
];

// Rayon max driver/départ selon type de trajet
const RAYON = { intra: 35, long: 60, autres: 50 };

// ── HELPER : créer un trajet ──────────────────────────────────────────────────
async function createTrajet({ passenger, prefs, candidats, depPoint, arrPoint, typeTrajet }) {
  if (!candidats.length) return null;

  // Scorer candidats et choisir selon distribution réaliste
  const scored = candidats
    .map((d) => ({ driver: d, score: matchScore(prefs, d) }))
    .sort((a, b) => b.score - a.score);

  const cutGood = Math.floor(scored.length * 0.40);
  const cutMid  = Math.floor(scored.length * 0.75);
  const good    = scored.slice(0, cutGood);
  const mid     = scored.slice(cutGood, cutMid);
  const bad     = scored.slice(cutMid);

  const r = Math.random();
  let chosen;
  if      (r < 0.60 && good.length) chosen = randomChoice(good).driver;
  else if (r < 0.85 && mid.length)  chosen = randomChoice(mid).driver;
  else if (bad.length)               chosen = randomChoice(bad).driver;
  else                               chosen = randomChoice(good).driver;

  const ms          = matchScore(prefs, chosen);
  const heureDepart = `${randomInt(6, 22)}:${randomChoice(["00", "15", "30", "45"])}`;

  // Distance réelle driver → point de départ
  let distKm = null;
  if (chosen.latitude && chosen.longitude) {
    distKm = parseFloat(
      haversine(chosen.latitude, chosen.longitude, depPoint.lat, depPoint.lng).toFixed(2)
    );
  }

  // Status selon matchScore
  const rnd = Math.random();
  let status;
  if      (ms > 0.70) status = rnd < 0.90 ? "COMPLETED" : "CANCELLED_BY_PASSENGER";
  else if (ms > 0.45) status = rnd < 0.70 ? "COMPLETED" : rnd < 0.90 ? "CANCELLED_BY_PASSENGER" : "PENDING";
  else                status = rnd < 0.40 ? "COMPLETED" : rnd < 0.85 ? "CANCELLED_BY_PASSENGER" : "PENDING";

  // Rating cohérent avec matchScore
  let rating = null;
  if (status === "COMPLETED") {
    const base  = ms * 3.5 + 1.5;
    const noise = (Math.random() - 0.5) * 0.6;
    rating = parseFloat(Math.max(1.0, Math.min(5.0, base + noise)).toFixed(1));
  }

  // Prix réaliste selon type
  const prix = typeTrajet === "intra"
    ? parseFloat(randomInt(150, 600).toFixed(2))
    : parseFloat(randomInt(800, 3500).toFixed(2));

  const mlScores = buildMlScores(prefs, chosen, heureDepart, distKm);

  try {
    const trajet = await prisma.trajet.create({
      data: {
        driver:       { connect: { id: chosen.id } },
        passenger:    { connect: { id: passenger.id } },
        depart:       depPoint.name,
        destination:  arrPoint.name,
        startLat:     depPoint.lat,
        startLng:     depPoint.lng,
        startAddress: depPoint.address,
        endLat:       arrPoint.lat,
        endLng:       arrPoint.lng,
        endAddress:   arrPoint.address,
        dateDepart:   new Date(Date.now() - randomInt(1, 120) * 86400000),
        heureDepart,
        placesDispo:  randomInt(1, 4),
        prix,
        status,
        quiet_ride:         prefs.quiet_ride,
        radio_ok:           prefs.radio_ok,
        smoking_ok:         prefs.smoking_ok,
        pets_ok:            prefs.pets_ok,
        luggage_large:      prefs.luggage_large,
        female_driver_pref: prefs.female_driver_pref,
        mlScores,
      },
    });

    let evalCreated = false;
    let fbSent      = false;

    if (status === "COMPLETED" && rating !== null) {
      await prisma.evaluation.create({ data: { trajetId: trajet.id, rating } });
      evalCreated = true;
      await sendFeedbackToFastAPI(rating, mlScores);
      fbSent = true;
    }

    return { eval: evalCreated, fb: fbSent };
  } catch (e) {
    console.error(`❌ (p${passenger.id}, d${chosen.id}): ${e.message}`);
    return null;
  }
}

// ── SEED PRINCIPAL ────────────────────────────────────────────────────────────
async function seedTrajets() {
  const passengers = await prisma.passenger.findMany();
  const drivers    = await prisma.driver.findMany();

  console.log(`📊 Passengers : ${passengers.length}`);
  console.log(`📊 Drivers    : ${drivers.length}`);

  if (!passengers.length || !drivers.length) {
    console.error("❌ Lance d'abord seedPassengers et seedDrivers !");
    process.exit(1);
  }

  const driversAlger  = drivers.filter((d) => d.wilaya === "Alger");
  const driversAutres = drivers.filter((d) => d.wilaya !== "Alger");
  console.log(`📊 Drivers Alger  : ${driversAlger.length}`);
  console.log(`📊 Drivers Autres : ${driversAutres.length}`);

  console.log("\n🗑️  Nettoyage...");
  await prisma.evaluation.deleteMany({});
  await prisma.trajet.deleteMany({});
  console.log("✅ Nettoyé\n");

  let totalTrajets  = 0;
  let totalEvals    = 0;
  let totalFeedback = 0;

  for (const passenger of passengers) {
    const profile   = getProfile(passenger.id);
    const nbTrajets = randomInt(10, 18);

    // Distribution : 65% Alger, 35% autres wilayas
    const nAlger  = Math.round(nbTrajets * 0.65);
    const nAutres = nbTrajets - nAlger;

    // Alger : 55% intra-Alger, 45% long
    const nIntra = Math.round(nAlger * 0.55);
    const nLong  = nAlger - nIntra;

    // ── INTRA-ALGER ───────────────────────────────────────────────────────────
    for (let i = 0; i < nIntra; i++) {
      const depPoint  = randomChoice(ALGER_POINTS);
      const arrPoint  = randomChoice(ALGER_POINTS.filter((p) => p.name !== depPoint.name));
      const prefs     = profile.prefs();

      const candidats = driversAlger.filter((d) => {
        if (!d.latitude || !d.longitude) return false;
        return haversine(d.latitude, d.longitude, depPoint.lat, depPoint.lng) <= RAYON.intra;
      });

      const res = await createTrajet({ passenger, prefs, candidats: candidats.length ? candidats : driversAlger.slice(0, 15), depPoint, arrPoint, typeTrajet: "intra" });
      if (res) { totalTrajets++; if (res.eval) totalEvals++; if (res.fb) totalFeedback++; }
    }

    // ── ALGER → LONGUE DISTANCE ───────────────────────────────────────────────
    for (let i = 0; i < nLong; i++) {
      const depPoint = randomChoice(ALGER_POINTS.slice(0, 5)); // centre Alger
      const arrPoint = randomChoice(AUTRES_POINTS);
      const prefs    = profile.prefs();

      const candidats = driversAlger.filter((d) => {
        if (!d.latitude || !d.longitude) return false;
        return haversine(d.latitude, d.longitude, depPoint.lat, depPoint.lng) <= RAYON.long;
      });

      const res = await createTrajet({ passenger, prefs, candidats: candidats.length ? candidats : driversAlger.slice(0, 20), depPoint, arrPoint, typeTrajet: "long" });
      if (res) { totalTrajets++; if (res.eval) totalEvals++; if (res.fb) totalFeedback++; }
    }

    // ── AUTRES WILAYAS ────────────────────────────────────────────────────────
    for (let i = 0; i < nAutres; i++) {
      const depPoint = randomChoice(AUTRES_POINTS);
      const arrPoint = randomChoice(AUTRES_POINTS.filter((p) => p.wilaya !== depPoint.wilaya));
      const prefs    = profile.prefs();

      const candidats = driversAutres.filter((d) => {
        if (!d.latitude || !d.longitude) return false;
        return haversine(d.latitude, d.longitude, depPoint.lat, depPoint.lng) <= RAYON.autres;
      });

      const res = await createTrajet({ passenger, prefs, candidats: candidats.length >= 3 ? candidats : driversAutres.slice(0, 10), depPoint, arrPoint, typeTrajet: "autres" });
      if (res) { totalTrajets++; if (res.eval) totalEvals++; if (res.fb) totalFeedback++; }
    }
  }

  console.log(`\n✅ ${totalTrajets} trajets créés`);
  console.log(`✅ ${totalEvals} évaluations créées`);
  console.log(`✅ ${totalFeedback} feedbacks envoyés à FastAPI`);

  // Mise à jour avgRating
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

  // Distribution ratings
  console.log("\n📈 Distribution des ratings créés :");
  const evals = await prisma.evaluation.findMany();
  const dist  = { "4.5-5": 0, "3.5-4.4": 0, "2.5-3.4": 0, "<2.5": 0 };
  evals.forEach((e) => {
    if      (e.rating >= 4.5) dist["4.5-5"]++;
    else if (e.rating >= 3.5) dist["3.5-4.4"]++;
    else if (e.rating >= 2.5) dist["2.5-3.4"]++;
    else                      dist["<2.5"]++;
  });
  console.log(`   4.5–5.0 : ${dist["4.5-5"]}`);
  console.log(`   3.5–4.4 : ${dist["3.5-4.4"]}`);
  console.log(`   2.5–3.4 : ${dist["2.5-3.4"]}`);
  console.log(`   < 2.5   : ${dist["<2.5"]}`);

  await prisma.$disconnect();
}

seedTrajets().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});