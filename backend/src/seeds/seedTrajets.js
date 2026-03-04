// seed.trajets.js
// ✅ Patterns réalistes pour LightFM :
//    préférences + heure de travail + distance influencent la note
//    → LightFM apprend ces patterns

import { prisma } from "../config/prisma.js";

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt    = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ── HAVERSINE : distance réelle en km entre deux points GPS ─────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── SCORE DISTANCE selon délai avant départ ──────────────────────────────────
// Plus le départ est lointain dans le temps, moins la distance compte
function scoreDistance(distanceKm, hoursUntilDeparture) {
  let referenceKm;
  if      (hoursUntilDeparture < 2)   referenceKm = 15;   // très proche : rayon 15km
  else if (hoursUntilDeparture < 24)  referenceKm = 40;   // aujourd'hui  : rayon 40km
  else if (hoursUntilDeparture < 168) referenceKm = 80;   // cette semaine: rayon 80km
  else                                referenceKm = 200;  // plus tard    : rayon 200km

  // Score décroissant : 1/(1 + dist/rayon) → entre 0 et 1
  return 1 / (1 + distanceKm / referenceKm);
}

// ── SCORE HEURE DE TRAVAIL ───────────────────────────────────────────────────
function scoreWorkingHour(driver, departureHour) {
  if (departureHour >= 5  && departureHour < 12  && driver.works_morning)   return 1.0;
  if (departureHour >= 12 && departureHour < 18  && driver.works_afternoon) return 1.0;
  if (departureHour >= 18 && departureHour < 22  && driver.works_evening)   return 1.0;
  if ((departureHour >= 22 || departureHour < 5) && driver.works_night)     return 1.0;
  return 0.2; // driver travaille pas à cette heure → score faible
}

// ── PROFILS DE PASSAGERS ─────────────────────────────────────────────────────
const PASSENGER_PROFILES = [
  {
    type: "calme", weight: 0.4,
    prefs: () => ({
      quiet_ride:        "yes",
      radio_ok:          "no",
      smoking_ok:        "no",
      pets_ok:           "no",
      luggage_large:     Math.random() > 0.5 ? "yes" : "no",
      female_driver_pref:"no",
    }),
  },
  {
    type: "social", weight: 0.25,
    prefs: () => ({
      quiet_ride:        "no",
      radio_ok:          "yes",
      smoking_ok:        Math.random() > 0.5 ? "yes" : "no",
      pets_ok:           "yes",
      luggage_large:     "no",
      female_driver_pref:"no",
    }),
  },
  {
    type: "female_pref", weight: 0.2,
    prefs: () => ({
      quiet_ride:        Math.random() > 0.5 ? "yes" : "no",
      radio_ok:          Math.random() > 0.5 ? "yes" : "no",
      smoking_ok:        "no",
      pets_ok:           "no",
      luggage_large:     "no",
      female_driver_pref:"yes",
    }),
  },
  {
    type: "luggage", weight: 0.15,
    prefs: () => ({
      quiet_ride:        "yes",
      radio_ok:          "no",
      smoking_ok:        "no",
      pets_ok:           "no",
      luggage_large:     "yes",
      female_driver_pref:"no",
    }),
  },
];

function getProfileForPassenger(passengerId) {
  const rand = (passengerId * 7 + 13) % 100;
  if (rand < 40) return PASSENGER_PROFILES[0]; // calme
  if (rand < 65) return PASSENGER_PROFILES[1]; // social
  if (rand < 85) return PASSENGER_PROFILES[2]; // female_pref
  return PASSENGER_PROFILES[3];                // luggage
}

// ── CALCUL DU MATCHING COMPLET ───────────────────────────────────────────────
function calculateMatchScore(driver, prefs, distanceKm, hoursUntilDeparture, departureHour) {
  let score    = 0;
  let maxScore = 0;

  // Quiet ride (poids 3)
  maxScore += 3;
  if      (prefs.quiet_ride === "yes" && !driver.talkative) score += 3;
  else if (prefs.quiet_ride === "no"  && driver.talkative)  score += 2;
  else if (prefs.quiet_ride === "yes" && driver.talkative)  score -= 1;

  // Radio (poids 1)
  maxScore += 1;
  if      (prefs.radio_ok === "yes" && driver.radio_on)  score += 1;
  else if (prefs.radio_ok === "no"  && !driver.radio_on) score += 1;

  // Smoking (poids 2)
  maxScore += 2;
  if      (prefs.smoking_ok === "yes" && driver.smoking_allowed)  score += 2;
  else if (prefs.smoking_ok === "no"  && !driver.smoking_allowed) score += 2;
  else if (prefs.smoking_ok === "no"  && driver.smoking_allowed)  score -= 1;

  // Pets (poids 2)
  maxScore += 2;
  if (prefs.pets_ok === "yes" && driver.pets_allowed) score += 2;

  // Luggage (poids 2)
  maxScore += 2;
  if      (prefs.luggage_large === "yes" && driver.car_big)  score += 2;
  else if (prefs.luggage_large === "yes" && !driver.car_big) score -= 1;

  // Gender (poids 1)
  maxScore += 1;
  if      (prefs.female_driver_pref === "yes" && driver.sexe === "F") score += 1;
  else if (prefs.female_driver_pref === "yes" && driver.sexe === "M") score -= 1;

  const prefScore = Math.max(0, score) / maxScore;

  // ✅ Score heure de travail (poids 2)
  const workScore = scoreWorkingHour(driver, departureHour);

  // ✅ Score distance selon délai (poids 1.5)
  const distScore = scoreDistance(distanceKm, hoursUntilDeparture);

  // Score final pondéré
  const finalScore = prefScore * 0.55 + workScore * 0.25 + distScore * 0.20;
  return parseFloat(finalScore.toFixed(4));
}

// ── VILLES AVEC COORDONNÉES GPS ──────────────────────────────────────────────
const VILLES = [
  { nom: "Alger Centre",      lat: 36.7538, lng: 3.0588 },
  { nom: "Oran Ville",        lat: 35.6969, lng: 0.6331 },
  { nom: "Constantine Centre",lat: 36.3650, lng: 6.6147 },
  { nom: "Annaba Ville",      lat: 36.9000, lng: 7.7667 },
  { nom: "Sétif Ville",       lat: 36.1898, lng: 5.4108 },
  { nom: "Blida Centre",      lat: 36.4700, lng: 2.8300 },
  { nom: "Tizi Ouzou",        lat: 36.7169, lng: 4.0497 },
  { nom: "Béjaïa Centre",     lat: 36.7515, lng: 5.0564 },
  { nom: "Médéa Ville",       lat: 36.2636, lng: 2.7539 },
  { nom: "Boumerdès",         lat: 36.7667, lng: 3.4667 },
];

// ── SEED PRINCIPAL ───────────────────────────────────────────────────────────
async function seedTrajets() {
  const passengers = await prisma.passenger.findMany();
  const drivers    = await prisma.driver.findMany();

  console.log(`📊 Passengers : ${passengers.length}`);
  console.log(`📊 Drivers    : ${drivers.length}`);

  if (passengers.length === 0 || drivers.length === 0) {
    console.error("❌ Lance d'abord seedPassengers et seedDrivers !");
    process.exit(1);
  }

  // Vérifier que les drivers ont des coordonnées
  const driversWithCoords = drivers.filter((d) => d.latitude && d.longitude);
  console.log(`📊 Drivers avec GPS : ${driversWithCoords.length}/${drivers.length}`);
  if (driversWithCoords.length === 0) {
    console.error("❌ Aucun driver n'a de coordonnées GPS ! Relance seedDrivers.");
    process.exit(1);
  }

  console.log("\n🗑️  Nettoyage des anciens trajets...");
  await prisma.evaluation.deleteMany({});
  await prisma.trajet.deleteMany({});
  console.log("✅ Nettoyé\n");

  console.log("🚀 Création des trajets avec patterns réalistes...\n");

  let totalTrajets = 0;
  let totalEvals   = 0;

  for (const passenger of passengers) {
    const profile    = getProfileForPassenger(passenger.id);
    const nbTrajets  = randomInt(8, 15);
    const sampledDrivers = [...driversWithCoords]
      .sort(() => 0.5 - Math.random())
      .slice(0, nbTrajets);

    for (const driver of sampledDrivers) {
      const prefs = profile.prefs();

      // ✅ Ville de départ et heure
      const villeDepart    = randomChoice(VILLES);
      const villeArrivee   = randomChoice(VILLES.filter((v) => v.nom !== villeDepart.nom));
      const departureHour  = randomInt(5, 23);
      const minuteStr      = randomChoice(["00", "15", "30", "45"]);
      const heureDepart    = `${departureHour}:${minuteStr}`;

      // ✅ Délai avant départ (entre 1h et 30 jours dans le passé pour les historiques)
      const hoursAgo           = randomInt(1, 720); // jusqu'à 30 jours
      const hoursUntilDeparture = randomInt(0, 720); // pour le score
      const dateDepart         = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

      // ✅ Distance réelle driver → point de départ du trajet
      const distanceKm = haversine(
        driver.latitude, driver.longitude,
        villeDepart.lat, villeDepart.lng
      );

      // ✅ Score global
      const matchScore = calculateMatchScore(
        driver, prefs, distanceKm, hoursUntilDeparture, departureHour
      );

      // Status basé sur le matching
      let status;
      const rand = Math.random();
      if      (matchScore > 0.6) status = rand < 0.80 ? "COMPLETED" : rand < 0.90 ? "CANCELLED_BY_PASSENGER" : "PENDING";
      else if (matchScore > 0.3) status = rand < 0.60 ? "COMPLETED" : rand < 0.85 ? "CANCELLED_BY_PASSENGER" : "PENDING";
      else                       status = rand < 0.35 ? "COMPLETED" : rand < 0.85 ? "CANCELLED_BY_PASSENGER" : "PENDING";

      // Note basée sur le matching
      let rating = null;
      if (status === "COMPLETED") {
        const baseRating = matchScore * 4.0 + 1.0;
        const noise      = (Math.random() - 0.5) * 1.0;
        rating           = parseFloat(Math.max(1.0, Math.min(5.0, baseRating + noise)).toFixed(1));
      }

      try {
        const trajet = await prisma.trajet.create({
          data: {
            driverId:   driver.id,
            passagerId: passenger.id,
            depart:      villeDepart.nom,
            destination: villeArrivee.nom,
            startLat:    villeDepart.lat,
            startLng:    villeDepart.lng,
            endLat:      villeArrivee.lat,
            endLng:      villeArrivee.lng,
            dateDepart,
            heureDepart,
            placesDispo: randomInt(1, 4),
            prix:        parseFloat(randomInt(300, 2500).toFixed(2)),
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
        console.error(`❌ Erreur (p${passenger.id}, d${driver.id}): ${e.message}`);
      }
    }
  }

  console.log(`✅ ${totalTrajets} trajets créés`);
  console.log(`✅ ${totalEvals} évaluations créées`);

  // ── Mise à jour avgRating ─────────────────────────────────────────────────
  console.log("\n📊 Mise à jour avgRating des drivers...");
  for (const driver of drivers) {
    const evals = await prisma.evaluation.findMany({
      where: { trajet: { driverId: driver.id } },
    });
    if (evals.length > 0) {
      const avg = evals.reduce((sum, e) => sum + e.rating, 0) / evals.length;
      await prisma.driver.update({
        where: { id: driver.id },
        data: {
          avgRating:    parseFloat(avg.toFixed(2)),
          ratingsCount: evals.length,
        },
      });
    }
  }
  console.log("✅ avgRating mis à jour\n");

  // ── Vérification des patterns ─────────────────────────────────────────────
  console.log("📈 Vérification des patterns :");
  const completed = await prisma.trajet.findMany({
    where: { status: "COMPLETED" },
    include: { evaluation: true, driver: true },
  });

  const quietMatch    = completed.filter((t) => t.quiet_ride === "yes" && !t.driver.talkative && (t.evaluation?.rating ?? 0) >= 4.0).length;
  const quietMismatch = completed.filter((t) => t.quiet_ride === "yes" && t.driver.talkative  && (t.evaluation?.rating ?? 0) <= 3.0).length;

  console.log(`   quiet=yes + talkative=false → note≥4 : ${quietMatch} cas`);
  console.log(`   quiet=yes + talkative=true  → note≤3 : ${quietMismatch} cas`);
  console.log("\n✅ Patterns prêts pour LightFM !");

  await prisma.$disconnect();
}

seedTrajets().catch((err) => {
  console.error("❌ Erreur globale :", err);
  process.exit(1);
});