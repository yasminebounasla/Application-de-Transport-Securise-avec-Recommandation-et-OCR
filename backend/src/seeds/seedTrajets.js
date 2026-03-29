// seed.trajets.js — CORRIGÉ
//
// BUGS CORRIGÉS :
//
//   ✅ Bug T1 — Le profil passager est LU depuis la base (profile_type)
//              et NON recalculé aléatoirement à chaque seed.
//              → relancer seed.trajets.js ne change pas le profil
//                d'un passager qui a déjà des interactions → cohérence garantie.
//
//   ✅ Bug T2 — Les prefs changent PAR TRAJET (comportement voulu) :
//              On tire les prefs de chaque trajet depuis les probabilités
//              du profil → variance intra-passager réaliste.
//              Ex : passager "quiet_comfort" → quiet_ride=yes dans ~90%
//              de ses trajets, mais radio_ok peut varier.
//              LightFM apprend "quand quiet_ride=yes ET driver calme → bonne note"
//              et non pas un profil figé.
//
//   ✅ Bug T3 — Rating basé sur le match RÉEL prefs×driver de CE trajet.
//              Le signal content-based est ainsi ancré dans les prefs
//              du trajet exact, pas dans une moyenne passager.

import { prisma } from "../config/prisma.js";
// On importe les profils depuis seed.passengers.js pour éviter la duplication
// Si l'import ESM pose problème, copier-coller PASSENGER_PROFILES ci-dessous.
import { PASSENGER_PROFILES } from "./seedPassengers.js";

const randomInt    = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat  = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(6));
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomBool   = (pTrue = 0.5) => Math.random() < pTrue;

// ── PROFIL FALLBACK ───────────────────────────────────────────────────────────
// Si le passager n'a pas de profile_type en base (migration pas encore faite),
// on utilise le profil "neutral" par défaut.
const PROFILE_MAP = Object.fromEntries(
  PASSENGER_PROFILES.map((p) => [p.name, p])
);
const NEUTRAL_PROFILE = PROFILE_MAP["neutral"];

// ── ZONES GPS ALGER ────────────────────────────────────────────────────────────
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

// ── RATING BASÉ SUR LE MATCH PREFS×DRIVER DE CE TRAJET ───────────────────────
//
// C'est le cœur du signal content-based pour LightFM.
// La note reflète si les prefs du TRAJET ACTUEL sont satisfaites par le driver.
// Note : un passager peut avoir quiet_ride=yes dans 90% de ses trajets,
// mais la note dépend du driver de CHAQUE trajet.
function computeRealisticRating(trajetPrefs, driver) {
  const b = (val) => {
    if (val === null || val === undefined) return "no";
    if (typeof val === "boolean") return val ? "yes" : "no";
    return String(val).trim().toLowerCase();
  };

  const checks = [
    [trajetPrefs.quiet_ride,         b(driver.talkative) === "no",        2],
    [trajetPrefs.radio_ok,           b(driver.radio_on) === "yes",        1],
    [trajetPrefs.smoking_ok,         b(driver.smoking_allowed) === "yes", 2],
    [trajetPrefs.pets_ok,            b(driver.pets_allowed) === "yes",    2],
    [trajetPrefs.luggage_large,      b(driver.car_big) === "yes",         2],
    [trajetPrefs.female_driver_pref, driver.sexe?.toLowerCase() === "f",  2],
  ];

  let matchScore = 0;
  let totalChecks = 0;

  for (const [prefActive, driverMatches, weight] of checks) {
    if (!prefActive) continue;
    totalChecks += weight;
    if (driverMatches) matchScore += weight;
    else matchScore -= weight;
  }

  // Aucune préf active → note aléatoire centrée sur 4
  if (totalChecks === 0) return randomChoice([3, 4, 4, 4, 5]);

  const matchRatio = (matchScore + totalChecks) / (2 * totalChecks); // [0, 1]

  // Ajouter du bruit réaliste sur la note
  if      (matchRatio >= 0.80) return randomChoice([4, 5, 5]);
  else if (matchRatio >= 0.60) return randomChoice([3, 4, 4, 5]);
  else if (matchRatio >= 0.40) return randomChoice([3, 3, 4]);
  else if (matchRatio >= 0.20) return randomChoice([2, 2, 3]);
  else                         return randomChoice([1, 2]);
}

// ── SEED PRINCIPAL ────────────────────────────────────────────────────────────
async function seedTrajets(trajetsPerPassenger = 10) {
  console.log(`\n🚀 Seed trajets (${trajetsPerPassenger} trajets/passager en moyenne)\n`);

  try {
    // ✅ Bug T1 FIX : charger profile_type depuis la base
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

    // Compter les passagers sans profile_type (migration pas encore faite)
    const noProfile = passengers.filter((p) => !p.profile_type).length;
    if (noProfile > 0) {
      console.warn(`⚠️  ${noProfile} passagers sans profile_type → fallback "neutral"`);
      console.warn(`   Lancer seed.passengers.js d'abord pour assigner les profils.\n`);
    }

    console.log(`✅ ${passengers.length} passagers chargés (avec profils)`);
    console.log(`✅ ${drivers.length} drivers chargés\n`);

    let created = 0;
    let skipped = 0;

    for (const passenger of passengers) {
      // ✅ Bug T1 FIX : utiliser le profil stocké en base, pas un random
      const profile = PROFILE_MAP[passenger.profile_type] ?? NEUTRAL_PROFILE;

      const nbTrajets = randomInt(
        Math.max(1, trajetsPerPassenger - 2),
        trajetsPerPassenger + 3,
      );

      for (let t = 0; t < nbTrajets; t++) {
        const driver  = randomChoice(drivers);
        const zone    = randomChoice(ALGER_ZONES);
        const zoneEnd = randomChoice(ALGER_ZONES);
        const heure   = randomChoice(HEURES);

        // ✅ Bug T2 : prefs tirées depuis les probabilités du profil
        // Chaque trajet a ses propres prefs → variance intra-passager voulue
        const trajetPrefs = {
          quiet_ride:         randomBool(profile.prefs.quiet_ride),
          radio_ok:           randomBool(profile.prefs.radio_ok),
          smoking_ok:         randomBool(profile.prefs.smoking_ok),
          pets_ok:            randomBool(profile.prefs.pets_ok),
          luggage_large:      randomBool(profile.prefs.luggage_large),
          female_driver_pref: randomBool(profile.prefs.female_driver_pref),
        };

        // 10% d'annulations
        const isCancelled = randomBool(0.10);
        const status      = isCancelled ? "CANCELLED_BY_PASSENGER" : "COMPLETED";

        const daysAgo    = randomInt(1, 180);
        const dateDepart = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

        try {
          const startLat = zone.lat    + randomFloat(-0.02, 0.02);
          const startLng = zone.lng    + randomFloat(-0.02, 0.02);
          const endLat   = zoneEnd.lat + randomFloat(-0.02, 0.02);
          const endLng   = zoneEnd.lng + randomFloat(-0.02, 0.02);

          const trajet = await prisma.trajet.create({
            data: {
              passagerId:         passenger.id,
              driverId:           driver.id,
              status,
              heureDepart:        heure,
              dateDepart,
              depart:             zone.name,
              destination:        zoneEnd.name,
              placesDispo:        randomInt(1, 4),
              prix:               randomInt(150, 800),
              startLat,
              startLng,
              endLat,
              endLng,
              // Prefs stockées sur le trajet (pas sur le passager)
              quiet_ride:         trajetPrefs.quiet_ride         ? "yes" : "no",
              radio_ok:           trajetPrefs.radio_ok           ? "yes" : "no",
              smoking_ok:         trajetPrefs.smoking_ok         ? "yes" : "no",
              pets_ok:            trajetPrefs.pets_ok            ? "yes" : "no",
              luggage_large:      trajetPrefs.luggage_large      ? "yes" : "no",
              female_driver_pref: trajetPrefs.female_driver_pref ? "yes" : "no",
            },
          });

          // ✅ Bug T3 : rating basé sur le match prefs×driver de CE trajet
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
    if (skipped > 0) console.log(`⚠️  ${skipped} trajets ignorés (erreur schema)`);

    // ── Résumé distribution prefs ─────────────────────────────────────────
    const sample = await prisma.trajet.findMany({
      where: { status: "COMPLETED" },
      take:  500,
    });

    console.log("\n📊 Distribution prefs dans les trajets COMPLETED (échantillon 500) :");
    for (const col of ["quiet_ride", "radio_ok", "smoking_ok", "pets_ok", "luggage_large", "female_driver_pref"]) {
      const yes = sample.filter((t) => t[col] === "yes").length;
      const pct = sample.length > 0 ? Math.round((yes / sample.length) * 100) : 0;
      const ok  = pct >= 15 && pct <= 85 ? "✅" : "⚠️ ";
      console.log(`   ${col.padEnd(22)} : ${pct}% yes  ${ok}`);
    }
    console.log("\n💡 Idéal : entre 15% et 85% pour chaque pref.");
    console.log("   Hors de cette fourchette → pref_match pas contrasté → LightFM n'apprend rien.\n");

  } catch (error) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

seedTrajets(10);