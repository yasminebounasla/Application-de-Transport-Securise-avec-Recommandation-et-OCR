// seed.trajets.js
// ✅ Données avec VRAIS PATTERNS pour que LightFM apprenne vraiment
// La logique : les préférences du trajet influencent directement la note donnée au driver
// Si match bon  → note haute → weight élevé → LightFM apprend ce pattern
// Si match mauvais → note basse → weight faible → LightFM évite ce pattern

import { prisma } from "../config/prisma.js";

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomYesNo = () => (Math.random() > 0.5 ? "yes" : "no");

// ── PROFILS DE PASSAGERS ─────────────────────────────────────────────────────
// Chaque passager a un "type" avec des préférences dominantes
// Cela crée des patterns stables que LightFM peut apprendre
const PASSENGER_PROFILES = [
  // Type 1 : Passager calme (40% des passagers)
  {
    type: "calme",
    weight: 0.4,
    prefs: () => ({
      quiet_ride: "yes",
      radio_ok: "no",
      smoking_ok: "no",
      pets_ok: "no",
      luggage_large: Math.random() > 0.5 ? "yes" : "no",
      female_driver_pref: "no",
    }),
  },
  // Type 2 : Passager social (25% des passagers)
  {
    type: "social",
    weight: 0.25,
    prefs: () => ({
      quiet_ride: "no",
      radio_ok: "yes",
      smoking_ok: Math.random() > 0.5 ? "yes" : "no",
      pets_ok: "yes",
      luggage_large: "no",
      female_driver_pref: "no",
    }),
  },
  // Type 3 : Préfère conductrice (20% des passagers)
  {
    type: "female_pref",
    weight: 0.2,
    prefs: () => ({
      quiet_ride: Math.random() > 0.5 ? "yes" : "no",
      radio_ok: Math.random() > 0.5 ? "yes" : "no",
      smoking_ok: "no",
      pets_ok: "no",
      luggage_large: "no",
      female_driver_pref: "yes",
    }),
  },
  // Type 4 : Bagages + voiture grande (15% des passagers)
  {
    type: "luggage",
    weight: 0.15,
    prefs: () => ({
      quiet_ride: "yes",
      radio_ok: "no",
      smoking_ok: "no",
      pets_ok: "no",
      luggage_large: "yes",
      female_driver_pref: "no",
    }),
  },
];

function getProfileForPassenger(passengerId) {
  // Assigner un profil stable à chaque passager (pas random à chaque trajet)
  const rand = (passengerId * 7 + 13) % 100;
  if (rand < 40) return PASSENGER_PROFILES[0]; // calme
  if (rand < 65) return PASSENGER_PROFILES[1]; // social
  if (rand < 85) return PASSENGER_PROFILES[2]; // female_pref
  return PASSENGER_PROFILES[3];                // luggage
}

// ── CALCUL DU MATCHING ───────────────────────────────────────────────────────
function calculateMatchScore(driver, prefs) {
  let score = 0;
  let maxScore = 0;

  // Quiet ride (très important : poids 3)
  maxScore += 3;
  if (prefs.quiet_ride === "yes" && !driver.talkative) score += 3;
  else if (prefs.quiet_ride === "no" && driver.talkative) score += 2;
  else if (prefs.quiet_ride === "yes" && driver.talkative) score -= 1; // Mismatch pénalisé

  // Radio (poids 1)
  maxScore += 1;
  if (prefs.radio_ok === "yes" && driver.radio_on) score += 1;
  else if (prefs.radio_ok === "no" && !driver.radio_on) score += 1;

  // Smoking (poids 2)
  maxScore += 2;
  if (prefs.smoking_ok === "yes" && driver.smoking_allowed) score += 2;
  else if (prefs.smoking_ok === "no" && !driver.smoking_allowed) score += 2;
  else if (prefs.smoking_ok === "no" && driver.smoking_allowed) score -= 1; // Mismatch pénalisé

  // Pets (poids 2)
  maxScore += 2;
  if (prefs.pets_ok === "yes" && driver.pets_allowed) score += 2;

  // Luggage (poids 2)
  maxScore += 2;
  if (prefs.luggage_large === "yes" && driver.car_big) score += 2;
  else if (prefs.luggage_large === "yes" && !driver.car_big) score -= 1; // Mismatch pénalisé

  // Gender (poids 1)
  maxScore += 1;
  if (prefs.female_driver_pref === "yes" && driver.sexe === "F") score += 1;
  else if (prefs.female_driver_pref === "yes" && driver.sexe === "M") score -= 1; // Mismatch pénalisé

  // Normaliser entre 0 et 1
  return Math.max(0, score) / maxScore;
}

// ── SEED PRINCIPAL ───────────────────────────────────────────────────────────
async function seedTrajets() {
  const passengers = await prisma.passenger.findMany();
  const drivers = await prisma.driver.findMany();

  console.log(`📊 Passengers : ${passengers.length}`);
  console.log(`📊 Drivers    : ${drivers.length}`);

  if (passengers.length === 0 || drivers.length === 0) {
    console.error("❌ Lance d'abord seedPassengers et seedDrivers !");
    process.exit(1);
  }

  // Supprimer les anciens trajets et évaluations
  console.log("\n🗑️  Nettoyage des anciens trajets...");
  await prisma.evaluation.deleteMany({});
  await prisma.trajet.deleteMany({});
  console.log("✅ Nettoyé");

  console.log("\n🚀 Création des trajets avec patterns réalistes...\n");

  const CITY_POINTS = {
    "Alger Centre": { lat: 36.7538, lng: 3.0588, address: "Alger Centre, Alger, Algeria" },
    "Oran Ville": { lat: 35.6971, lng: -0.6308, address: "Oran Ville, Oran, Algeria" },
    "Constantine Centre": { lat: 36.3650, lng: 6.6147, address: "Constantine Centre, Constantine, Algeria" },
    "Annaba Ville": { lat: 36.9000, lng: 7.7667, address: "Annaba Ville, Annaba, Algeria" },
    "Sétif Ville": { lat: 36.1911, lng: 5.4137, address: "Sétif Ville, Sétif, Algeria" },
    "Blida Centre": { lat: 36.4700, lng: 2.8277, address: "Blida Centre, Blida, Algeria" },
    "Tizi Ouzou": { lat: 36.7169, lng: 4.0497, address: "Tizi Ouzou, Tizi Ouzou, Algeria" },
    "Béjaïa Centre": { lat: 36.7509, lng: 5.0567, address: "Béjaïa Centre, Béjaïa, Algeria" },
    "Médéa Ville": { lat: 36.2642, lng: 2.7583, address: "Médéa Ville, Médéa, Algeria" },
    "Boumerdès": { lat: 36.7664, lng: 3.4772, address: "Boumerdès, Boumerdès, Algeria" },
  };

  const VILLES_DEPART = ["Alger Centre", "Oran Ville", "Constantine Centre", "Annaba Ville", "Sétif Ville"];
  const VILLES_ARRIVEE = ["Blida Centre", "Tizi Ouzou", "Béjaïa Centre", "Médéa Ville", "Boumerdès"];

  let totalTrajets = 0;
  let totalEvals = 0;

  for (const passenger of passengers) {
    // Profil stable pour ce passager
    const profile = getProfileForPassenger(passenger.id);

    // Chaque passager fait entre 8 et 15 trajets avec des drivers différents
    const nbTrajets = randomInt(8, 15);
    const sampledDrivers = [...drivers]
      .sort(() => 0.5 - Math.random())
      .slice(0, nbTrajets);

    for (const driver of sampledDrivers) {
      // Préférences basées sur le profil du passager (avec un peu de variabilité)
      const prefs = profile.prefs();

      // Calculer le score de matching
      const matchScore = calculateMatchScore(driver, prefs);

      // ✅ STATUS basé sur le matching :
      // Bon matching → plus de chance d'être COMPLETED
      // Mauvais matching → plus de chance d'être annulé
      let status;
      const rand = Math.random();
      if (matchScore > 0.6) {
        // Bon match : 80% completed, 10% cancelled, 10% pending
        status = rand < 0.80 ? "COMPLETED" : rand < 0.90 ? "CANCELLED_BY_PASSENGER" : "PENDING";
      } else if (matchScore > 0.3) {
        // Match moyen : 60% completed, 25% cancelled, 15% pending
        status = rand < 0.60 ? "COMPLETED" : rand < 0.85 ? "CANCELLED_BY_PASSENGER" : "PENDING";
      } else {
        // Mauvais match : 35% completed, 50% cancelled, 15% pending
        status = rand < 0.35 ? "COMPLETED" : rand < 0.85 ? "CANCELLED_BY_PASSENGER" : "PENDING";
      }

      // ✅ NOTE basée sur le matching (le coeur des patterns) :
      // matchScore élevé → note haute → LightFM apprend que ces prefs → ce driver = bien
      let rating = null;
      if (status === "COMPLETED") {
        // Note = matching * 4 + 1 (entre 1 et 5) + bruit ±0.5
        const baseRating = matchScore * 4.0 + 1.0;
        const noise = (Math.random() - 0.5) * 1.0;
        rating = Math.max(1.0, Math.min(5.0, baseRating + noise));
        rating = parseFloat(rating.toFixed(1));
      }

      const depart = randomChoice(VILLES_DEPART);
      const destination = randomChoice(VILLES_ARRIVEE);
      const departPoint = CITY_POINTS[depart];
      const destinationPoint = CITY_POINTS[destination];

      try {
        const trajet = await prisma.trajet.create({
          data: {
            driverId: driver.id,
            passagerId: passenger.id,
            depart,
            destination,
            startLat: departPoint?.lat ?? null,
            startLng: departPoint?.lng ?? null,
            startAddress: departPoint?.address ?? depart,
            endLat: destinationPoint?.lat ?? null,
            endLng: destinationPoint?.lng ?? null,
            endAddress: destinationPoint?.address ?? destination,
            dateDepart: new Date(Date.now() - randomInt(1, 120) * 24 * 60 * 60 * 1000),
            heureDepart: `${randomInt(6, 22)}:${randomChoice(["00", "15", "30", "45"])}`,
            placesDispo: randomInt(1, 4),
            prix: parseFloat(randomInt(300, 2500).toFixed(2)),
            status,
            quiet_ride: prefs.quiet_ride,
            radio_ok: prefs.radio_ok,
            smoking_ok: prefs.smoking_ok,
            pets_ok: prefs.pets_ok,
            luggage_large: prefs.luggage_large,
            female_driver_pref: prefs.female_driver_pref,
          },
        });

        totalTrajets++;

        // Créer l'évaluation si COMPLETED
        if (status === "COMPLETED" && rating !== null) {
          await prisma.evaluation.create({
            data: {
              trajetId: trajet.id,
              rating,
            },
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

  // ── Mise à jour avgRating des drivers ────────────────────────────────────
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
          avgRating: parseFloat(avg.toFixed(2)),
          ratingsCount: evals.length,
        },
      });
    }
  }

  console.log("✅ avgRating mis à jour pour tous les drivers");

  // ── Résumé des patterns créés ─────────────────────────────────────────────
  console.log("\n📈 Résumé des patterns dans les données :");
  const completedTrajets = await prisma.trajet.findMany({
    where: { status: "COMPLETED" },
    include: { evaluation: true, driver: true },
  });

  // Vérifier que les patterns sont bien là
  const quietMatch = completedTrajets.filter(
    (t) => t.quiet_ride === "yes" && !t.driver.talkative && t.evaluation?.rating >= 4.0
  ).length;
  const quietMismatch = completedTrajets.filter(
    (t) => t.quiet_ride === "yes" && t.driver.talkative && t.evaluation?.rating <= 3.0
  ).length;

  console.log(`   quiet_ride=yes + talkative=false → note≥4 : ${quietMatch} cas`);
  console.log(`   quiet_ride=yes + talkative=true  → note≤3 : ${quietMismatch} cas`);
  console.log(`\n✅ Patterns bien présents dans les données → LightFM va apprendre !`);

  await prisma.$disconnect();
}

seedTrajets().catch((err) => {
  console.error("❌ Erreur globale :", err);
  process.exit(1);
});
