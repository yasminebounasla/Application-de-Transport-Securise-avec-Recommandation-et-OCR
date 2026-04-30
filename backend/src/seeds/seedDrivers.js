// seed.drivers.js — CORRIGÉ
//
// ✅ Bug 4 FIX — Les features des drivers ne sont plus 100% aléatoires.
//
// PROBLÈME ORIGINAL :
//   Chaque feature (talkative, radio_on, smoking_allowed...) = randomBool() = 50/50.
//   Résultat : statistiquement 50% de drivers pour chaque préférence.
//   LightFM ne peut pas apprendre "ce passager préfère les drivers calmes"
//   si 50% des drivers sont calmes ET 50% sont bavards — aucun signal discriminant.
//
// SOLUTION :
//   Les drivers ont maintenant des PROFILS cohérents (comme les passagers dans seed.trajets.js).
//   Ex : profil "chauffeur_pro" → souvent calme, pas fumeur, grand coffre
//        profil "conducteur_cool" → souvent bavard, radio, fumeur OK
//   → LightFM peut apprendre que passager quiet_ride → driver calme = bonne note
//
// NOTE : La distribution reste variée (20-80% pour chaque feature)
// pour que le modèle voie du contraste.

import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";

const PRENOMS_F = ["Sara", "Lina", "Amira", "Nour", "Yasmine", "Fatima", "Meriem", "Salma", "Rania", "Asma"];
const PRENOMS_M = ["Hawas", "Mohamed", "Yassine", "Karim", "Mehdi", "Hamza", "Rami", "Khaled", "Sofiane", "Amine"];
const NOMS = ["Benali", "Mansouri", "Bouzid", "Belkacem", "Haddad", "Amrani", "Slimani", "Meziane", "Bouaziz", "Cherif"];

const ALGER_ZONES = [
  { lat: 36.7538, lng: 3.0588 }, { lat: 36.7197, lng: 3.1833 },
  { lat: 36.7456, lng: 3.0231 }, { lat: 36.7631, lng: 2.9997 },
  { lat: 36.7272, lng: 3.0939 }, { lat: 36.7167, lng: 3.1333 },
  { lat: 36.6961, lng: 3.2150 }, { lat: 36.7069, lng: 3.0514 },
  { lat: 36.7378, lng: 3.1108 }, { lat: 36.7406, lng: 3.1856 },
  { lat: 36.7333, lng: 3.2833 }, { lat: 36.7167, lng: 3.3500 },
  { lat: 36.7667, lng: 2.9667 }, { lat: 36.7500, lng: 2.8833 },
  { lat: 36.6833, lng: 2.8333 },
];

const AUTRES_WILAYAS = [
  { wilaya: "Oran", lat: 35.6969, lng: 0.6331 },
  { wilaya: "Constantine", lat: 36.3650, lng: 6.6147 },
  { wilaya: "Blida", lat: 36.4700, lng: 2.8300 },
  { wilaya: "Annaba", lat: 36.9000, lng: 7.7667 },
  { wilaya: "Bejaia", lat: 36.7515, lng: 5.0564 },
];

// ── ✅ Bug 4 FIX — PROFILS DRIVER COHÉRENTS ────────────────────────────────
// Chaque profil a des probabilités différentes par feature.
// 6 profils variés pour couvrir tout le spectre des préférences passagers.
const DRIVER_PROFILES = [
  {
    name: "chauffeur_pro",
    // Calme, pas de fumée, grand coffre, pas de radio → matche les passagers business/quiet
    probs: {
      talkative: 0.10, radio_on: 0.20, smoking_allowed: 0.05,
      pets_allowed: 0.30, car_big: 0.85,
      works_morning: 0.80, works_afternoon: 0.70, works_evening: 0.50, works_night: 0.20,
    },
  },
  {
    name: "conducteur_cool",
    // Bavard, radio, fumeur OK, accepte animaux → matche les passagers sociaux/relaxed
    probs: {
      talkative: 0.85, radio_on: 0.90, smoking_allowed: 0.75,
      pets_allowed: 0.70, car_big: 0.35,
      works_morning: 0.40, works_afternoon: 0.80, works_evening: 0.85, works_night: 0.40,
    },
  },
  {
    name: "chauffeur_famille",
    // Grand coffre, accepte animaux, calme, pas fumeur
    probs: {
      talkative: 0.30, radio_on: 0.50, smoking_allowed: 0.10,
      pets_allowed: 0.90, car_big: 0.90,
      works_morning: 0.70, works_afternoon: 0.80, works_evening: 0.60, works_night: 0.15,
    },
  },
  {
    name: "conducteur_nuit",
    // Travaille surtout la nuit et le soir, relaxed sur fumée et radio
    probs: {
      talkative: 0.50, radio_on: 0.70, smoking_allowed: 0.60,
      pets_allowed: 0.40, car_big: 0.40,
      works_morning: 0.15, works_afternoon: 0.30, works_evening: 0.90, works_night: 0.95,
    },
  },
  {
    name: "chauffeur_standard",
    // Profil équilibré — ni très calme ni très bavard
    probs: {
      talkative: 0.45, radio_on: 0.55, smoking_allowed: 0.35,
      pets_allowed: 0.45, car_big: 0.50,
      works_morning: 0.60, works_afternoon: 0.60, works_evening: 0.60, works_night: 0.30,
    },
  },
  {
    name: "chauffeur_matin",
    // Très matinal, calme (préfère le silence le matin), pas fumeur
    probs: {
      talkative: 0.15, radio_on: 0.30, smoking_allowed: 0.08,
      pets_allowed: 0.35, car_big: 0.55,
      works_morning: 0.95, works_afternoon: 0.40, works_evening: 0.20, works_night: 0.05,
    },
  },
];

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomBoolP = (p) => Math.random() < p;   // ✅ probabilité configurable
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(6));

async function seedDrivers(count = 100) {
  console.log(`Création de ${count} drivers avec profils cohérents (80 Alger + 20 autres wilayas)...\n`);
  const hashedPassword = await bcrypt.hash("Test123!", 10);
  const drivers = [];

  for (let i = 1; i <= count; i++) {
    const sexe = i % 2 === 0 ? "F" : "M";
    const prenom = randomChoice(sexe === "F" ? PRENOMS_F : PRENOMS_M);
    const nom = randomChoice(NOMS);

    // ✅ Bug 4 FIX : assigner un profil cohérent à chaque driver
    const profile = randomChoice(DRIVER_PROFILES);

    let wilaya, latitude, longitude;
    if (i <= 80) {
      const zone = randomChoice(ALGER_ZONES);
      wilaya = "Alger";
      latitude = zone.lat + randomFloat(-0.02, 0.02);
      longitude = zone.lng + randomFloat(-0.02, 0.02);
    } else {
      const w = randomChoice(AUTRES_WILAYAS);
      wilaya = w.wilaya;
      latitude = w.lat + randomFloat(-0.05, 0.05);
      longitude = w.lng + randomFloat(-0.05, 0.05);
    }

    drivers.push({
      email: `driver${i}@mail.com`,
      password: hashedPassword,
      nom,
      prenom,
      numTel: `0${randomInt(500000000, 799999999)}`,
      sexe,
      age: randomInt(22, 55),
      isVerified: true,
      hasAcceptedPhotoStorage: true,
      wilaya,
      latitude,
      longitude,
      // ✅ Bug 4 FIX : features basées sur le profil, pas randomBool() pur
      preferences: {
        create: {
          talkative:        randomBoolP(profile.probs.talkative),
          radio:            randomBoolP(profile.probs.radio_on),
          smoking:          randomBoolP(profile.probs.smoking_allowed),
          pets:             randomBoolP(profile.probs.pets_allowed),
          luggage_large:    randomBoolP(profile.probs.car_big),
          femal_driver_pref: false,
        }
      },
      workingHours: {
        create: {
          works_morning:   randomBoolP(profile.probs.works_morning),
          works_afternoon: randomBoolP(profile.probs.works_afternoon),
          works_evening:   randomBoolP(profile.probs.works_evening),
          works_night:     randomBoolP(profile.probs.works_night),
        }
      }
    });
  }

  try {
    let createdCount = 0;
    let updatedCount = 0;

    for (const driver of drivers) {
      const existing = await prisma.driver.findUnique({
        where: { email: driver.email },
        select: { id: true },
      });
      if (existing) {
        await prisma.driver.update({ where: { email: driver.email }, data: driver });
        updatedCount++;
      } else {
        await prisma.driver.create({ data: driver });
        createdCount++;
      }
    }

    console.log(`✅ ${createdCount} drivers créés avec succès!`);
    console.log(`✅ ${updatedCount} drivers mis à jour!\n`);

    // Résumé distribution features (doit être 20-80% pour chaque feature)
    const sample = await prisma.driver.findMany({
      take: count,
      include: { preferences: true, workingHours: true }
    });
    console.log("📊 Distribution features drivers (idéal : 20-80% pour chaque) :");
    for (const [col, accessor] of [
      ["talkative",       d => d.preferences?.talkative],
      ["radio",           d => d.preferences?.radio],
      ["smoking",         d => d.preferences?.smoking],
      ["pets",            d => d.preferences?.pets],
      ["luggage_large",   d => d.preferences?.luggage_large],
      ["works_morning",   d => d.workingHours?.works_morning],
      ["works_afternoon", d => d.workingHours?.works_afternoon],
      ["works_evening",   d => d.workingHours?.works_evening],
      ["works_night",     d => d.workingHours?.works_night],
    ]) {
      const yes = sample.filter(accessor).length;
      const pct = Math.round((yes / sample.length) * 100);
      const status = pct >= 15 && pct <= 85 ? "✅" : "⚠️ ";
      console.log(`   ${col.padEnd(20)} : ${pct}%  ${status}`);
    }

  } catch (error) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

seedDrivers(140);

export { seedDrivers };
