// seed.trajets.js — EXCLUSION STRICTE DES PRÉFÉRENCES
//
// CHANGEMENT PAR RAPPORT À LA VERSION PRÉCÉDENTE :
//
//   ✅ computeRealisticRating — logique exclusion stricte :
//        oui → driver DOIT avoir la feature, sinon pénalité maximale
//        non → driver NE DOIT PAS avoir la feature, sinon pénalité maximale
//
//        Avant : un mismatch = pénalité douce (matchScore -= weight)
//        Maintenant : toute violation stricte → note 1 ou 2 directement.
//        LightFM reçoit un signal clair : viole une pref = mauvaise note.
//
//   ✅ Les prefs "non" ont exactement la même force que "oui".
//        Un passager qui dit quiet_ride=non veut un driver BAVARD.
//        Si le driver est calme → même pénalité que quiet_ride=oui + driver bavard.

import { prisma } from "../config/prisma.js";
import { PASSENGER_PROFILES } from "./seedPassengers.js";

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(6));
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomBool = (pTrue = 0.5) => Math.random() < pTrue;

const PROFILE_MAP = Object.fromEntries(PASSENGER_PROFILES.map((p) => [p.name, p]));
const NEUTRAL_PROFILE = PROFILE_MAP["neutral"];

const ALGER_ZONES = [
  { lat: 36.7538, lng: 3.0588, name: "Alger Centre" },
  { lat: 36.7197, lng: 3.1833, name: "El Harrach" },
  { lat: 36.7456, lng: 3.0231, name: "Bab El Oued" },
  { lat: 36.7631, lng: 2.9997, name: "Ain Benian" },
  { lat: 36.7272, lng: 3.0939, name: "Hussein Dey" },
  { lat: 36.7167, lng: 3.1333, name: "Kouba" },
  { lat: 36.7069, lng: 3.0514, name: "Bir Mourad Rais" },
  { lat: 36.7378, lng: 3.1108, name: "El Madania" },
];

const HEURES = ["06:00", "07:30", "08:00", "09:00", "12:00", "14:00", "17:00", "18:30", "20:00", "22:00"];

function compatibilityScore(driver, prefs) {
  let score = 0;

  if (prefs.quiet_ride && !toBool(driver.talkative)) score++;
  if (!prefs.quiet_ride && toBool(driver.talkative)) score++;

  if (prefs.radio_ok && toBool(driver.radio_on)) score++;
  if (!prefs.radio_ok && !toBool(driver.radio_on)) score++;

  if (prefs.smoking_ok && toBool(driver.smoking_allowed)) score++;
  if (!prefs.smoking_ok && !toBool(driver.smoking_allowed)) score++;

  if (prefs.pets_ok && toBool(driver.pets_allowed)) score++;
  if (!prefs.pets_ok && !toBool(driver.pets_allowed)) score++;

  if (prefs.luggage_large && toBool(driver.car_big)) score++;
  if (!prefs.luggage_large && !toBool(driver.car_big)) score++;

  const isFemale = String(driver.sexe || "").toLowerCase() === "f";
  if (prefs.female_driver_pref && isFemale) score++;
  if (!prefs.female_driver_pref && !isFemale) score++;

  return score; // max = 6
}

function pickDriver(drivers, prefs) {
  const rand = Math.random();

  if (rand < 0.55) {
    const perfect = drivers.filter(d => compatibilityScore(d, prefs) === 6);
    if (perfect.length > 0) return randomChoice(perfect);
  }

  if (rand < 0.75) {
    const good = drivers.filter(d => compatibilityScore(d, prefs) >= 5);
    if (good.length > 0) return randomChoice(good);
  }

  if (rand < 0.90) {
    const partial = drivers.filter(d => {
      const s = compatibilityScore(d, prefs);
      return s >= 3 && s <= 4;
    });
    if (partial.length > 0) return randomChoice(partial);
  }

  return randomChoice(drivers);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function toBool(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === "boolean") return val;
  const s = String(val).trim().toLowerCase();
  return s === "yes" || s === "true" || s === "1" || s === "oui";
}

// ── RATING — EXCLUSION STRICTE ────────────────────────────────────────────────
//
// Règle : si UNE SEULE pref active est violée → note mauvaise (1-2)
// Règle : si TOUTES les prefs actives sont satisfaites → note bonne (4-5)
// Règle : si aucune pref active → note aléatoire centrée sur 4
//
// C'est intentionnellement tranché pour que LightFM voie un signal fort.
// En réalité les passagers sont aussi tranchés : si tu fumes dans ma voiture
// alors que j'ai dit non, je mets 1 étoile, peu importe le reste.

function computeRealisticRating(trajetPrefs, driver) {
  const RULES = [
    // [prefActive, driverSatisfiesIfYes,                                         weight]
    [trajetPrefs.quiet_ride, () => !toBool(driver.talkative), 2],
    [trajetPrefs.radio_ok, () => toBool(driver.radio_on), 1],
    [trajetPrefs.smoking_ok, () => toBool(driver.smoking_allowed), 2],
    [trajetPrefs.pets_ok, () => toBool(driver.pets_allowed), 2],
    [trajetPrefs.luggage_large, () => toBool(driver.car_big), 2],
    [trajetPrefs.female_driver_pref, () => String(driver.sexe || "").trim().toLowerCase() === "f", 2],
  ];

  // prefActive est un booléen (true = oui, false = non)
  // driverSatisfiesIfYes() = true si driver match quand pref=oui
  // Si pref=non → on veut l'inverse de driverSatisfiesIfYes()

  let strictViolations = 0;
  let totalActive = 0;

  for (const [prefActive, driverSatisfiesIfYes, weight] of RULES) {
    // prefActive ici est bool (issu de trajetPrefs.xxx = randomBool(prob))
    // Mais la sémantique est : true = "oui je veux ça", false = "non je ne veux pas ça"
    // → les deux sont des prefs actives, juste dans des directions opposées

    totalActive++;  // toutes les features comptent

    const driverHasFeature = driverSatisfiesIfYes();

    if (prefActive === true && !driverHasFeature) strictViolations++;
    if (prefActive === false && driverHasFeature) strictViolations++;
  }

  // Aucune pref active pertinente → note aléatoire
  if (totalActive === 0) return randomChoice([3, 4, 4, 4, 5]);

  const violationRatio = strictViolations / totalActive;

  // ✅ Signal tranché :
  if (violationRatio === 0) return randomChoice([4, 5, 5]);         // tout OK
  else if (violationRatio <= 0.17) return randomChoice([3, 4, 4, 5]);     // 1/6 violée
  else if (violationRatio <= 0.33) return randomChoice([3, 3, 4]);        // 2/6 violées
  else if (violationRatio <= 0.50) return randomChoice([2, 2, 3]);        // 3/6 violées
  else return randomChoice([1, 2]);            // > 3/6 violées
}

// ── SEED PRINCIPAL ────────────────────────────────────────────────────────────
async function seedTrajets(trajetsPerPassenger = 10) {
  console.log(`\n🚀 Seed trajets (${trajetsPerPassenger} trajets/passager en moyenne) — exclusion stricte\n`);

  try {
    const passengers = await prisma.passenger.findMany({
      select: { id: true, profile_type: true },
    });
    const drivers = await prisma.driver.findMany();

    if (passengers.length === 0) {
      console.error("❌ Aucun passager — lancer seed.passengers.js d'abord");
      return;
    }
    if (drivers.length === 0) {
      console.error("❌ Aucun driver — lancer seed.drivers.js d'abord");
      return;
    }

    const noProfile = passengers.filter((p) => !p.profile_type).length;
    if (noProfile > 0) {
      console.warn(`⚠️  ${noProfile} passagers sans profile_type → fallback "neutral"`);
    }

    console.log(`✅ ${passengers.length} passagers | ${drivers.length} drivers\n`);

    let created = 0;
    let skipped = 0;

    for (const passenger of passengers) {
      const profile = PROFILE_MAP[passenger.profile_type] ?? NEUTRAL_PROFILE;
      const nbTrajets = randomInt(
        Math.max(1, trajetsPerPassenger - 2),
        trajetsPerPassenger + 3,
      );


      for (let t = 0; t < nbTrajets; t++) {
        // Prefs tirées depuis les probabilités du profil (par trajet)
        const trajetPrefs = {
          quiet_ride: randomBool(profile.prefs.quiet_ride),
          radio_ok: randomBool(profile.prefs.radio_ok),
          smoking_ok: randomBool(profile.prefs.smoking_ok),
          pets_ok: randomBool(profile.prefs.pets_ok),
          luggage_large: randomBool(profile.prefs.luggage_large),
          female_driver_pref: randomBool(profile.prefs.female_driver_pref),
        };

        const driver = pickDriver(drivers, trajetPrefs);
        const zone = randomChoice(ALGER_ZONES);
        const zoneEnd = randomChoice(ALGER_ZONES);
        const heure = randomChoice(HEURES);



        const isCancelled = randomBool(0.10);
        const status = isCancelled ? "CANCELLED_BY_PASSENGER" : "COMPLETED";
        const daysAgo = randomInt(1, 180);
        const dateDepart = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

        try {
          const startLat = zone.lat + randomFloat(-0.02, 0.02);
          const startLng = zone.lng + randomFloat(-0.02, 0.02);
          const endLat = zoneEnd.lat + randomFloat(-0.02, 0.02);
          const endLng = zoneEnd.lng + randomFloat(-0.02, 0.02);

          const trajet = await prisma.trajet.create({
            data: {
              passagerId: passenger.id,
              driverId: driver.id,
              status,
              heureDepart: heure,
              dateDepart,
              depart: zone.name,
              destination: zoneEnd.name,
              placesDispo: randomInt(1, 4),
              prix: randomInt(150, 800),
              startLat,
              startLng,
              endLat,
              endLng,
              quiet_ride: trajetPrefs.quiet_ride ? "yes" : "no",
              radio_ok: trajetPrefs.radio_ok ? "yes" : "no",
              smoking_ok: trajetPrefs.smoking_ok ? "yes" : "no",
              pets_ok: trajetPrefs.pets_ok ? "yes" : "no",
              luggage_large: trajetPrefs.luggage_large ? "yes" : "no",
              female_driver_pref: trajetPrefs.female_driver_pref ? "yes" : "no",
            },
          });

          // ✅ Rating basé sur exclusion stricte
          if (status === "COMPLETED") {
            const rating = computeRealisticRating(trajetPrefs, driver);
            await prisma.evaluation.create({
              data: { trajetId: trajet.id, rating },
            });
          }

          created++;
        } catch (err) {
          skipped++;
          if (skipped <= 3) console.warn(`⚠️  Trajet skipped: ${err.message}`);
        }
      }
    }

    console.log(`\n✅ ${created} trajets créés`);
    if (skipped > 0) console.log(`⚠️  ${skipped} trajets ignorés`);

    // ── Résumé distribution notes ─────────────────────────────────────────
    const evaluations = await prisma.evaluation.findMany({ take: 1000 });
    const ratingDist = [1, 2, 3, 4, 5].map((r) => ({
      note: r,
      nb: evaluations.filter((e) => e.rating === r).length,
    }));

    console.log("\n📊 Distribution notes (exclusion stricte — idéal : contraste 1-2 vs 4-5) :");
    for (const { note, nb } of ratingDist) {
      const bar = "█".repeat(Math.round((nb / evaluations.length) * 30));
      console.log(`   Note ${note} : ${nb.toString().padStart(4)} ${bar}`);
    }
    console.log("\n💡 Bon signal : beaucoup de 1-2 ET beaucoup de 4-5, peu de 3.");
    console.log("   Si tout est groupé autour de 3-4, les prefs ne sont pas assez contrastées.\n");

  } catch (error) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

seedTrajets(10);

export { seedTrajets };
