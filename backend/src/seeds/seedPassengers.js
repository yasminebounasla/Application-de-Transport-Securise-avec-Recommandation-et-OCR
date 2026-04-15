// seed.passengers.js — CORRIGÉ
//
// BUGS CORRIGÉS :
//
//   ✅ Bug P1 — Profil latent persisté sur le passager :
//              Chaque passager reçoit un "profile_type" stocké en base.
//              → ses trajets futurs (seed.trajets.js) tirent les prefs
//                depuis ce profil → cohérence inter-trajets garantie
//                même si on relance le seed plusieurs fois.
//
//   ✅ Bug P2 — Les prefs changent PAR TRAJET (pas par passager) :
//              Le passager n'a PAS de prefs fixes stockées.
//              Il a un profil qui définit des PROBABILITÉS de prefs.
//              Chaque trajet tire ses propres prefs depuis ces probabilités.
//              → un passager "quiet_comfort" aura quiet_ride=yes dans 90%
//                de ses trajets, mais pas forcément dans tous.
//              → LightFM voit de la variance intra-passager = signal réaliste.
//
//   ✅ Bug P3 — Distribution équilibrée des 7 profils (round-robin)
//              pour que LightFM voie tous les types de passagers.

import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";

const PRENOMS_F = ["Ines", "Aya", "Yasmine", "Nour", "Lina", "Amel", "Imane", "Sonia", "Salma", "Maya"];
const PRENOMS_M = ["Hawas", "Mohamed", "Yassine", "Karim", "Mehdi", "Hamza", "Rami", "Khaled", "Sofiane", "Amine"];
const NOMS = ["Benali", "Mansouri", "Bouzid", "Belkacem", "Haddad", "Amrani", "Slimani", "Meziane"];

// ── PROFILS LATENTS PASSAGER ──────────────────────────────────────────────────
//
// Un profil = des PROBABILITÉS de prefs, pas des prefs fixes.
// Les prefs réelles sont tirées trajet par trajet dans seed.trajets.js.
//
// Pourquoi des probabilités et pas des valeurs fixes ?
//   → Parce que les prefs d'un passager changent selon le contexte :
//     un voyageur "quiet_comfort" voudra peut-être la radio un jour
//     où il est de bonne humeur. Le profil capture la TENDANCE.
//   → LightFM apprend mieux avec de la variance intra-passager :
//     ça lui montre que ce passager, quand il veut quiet_ride=yes,
//     il note mieux les drivers calmes — signal plus propre que
//     si tous les trajets avaient exactement les mêmes prefs.
//
// Ces profils sont EXPORTÉS pour être utilisés dans seed.trajets.js.
export const PASSENGER_PROFILES = [
  {
    name: "quiet_comfort",
    // Veut du calme — profil voyageur d'affaires ou étudiant
    prefs: {
      quiet_ride: 0.90,
      radio_ok: 0.15,
      smoking_ok: 0.05,
      pets_ok: 0.30,
      luggage_large: 0.20,
      female_driver_pref: 0.40,
    },
  },
  {
    name: "social_music",
    // Bavard, aime la radio, profil social
    prefs: {
      quiet_ride: 0.05,
      radio_ok: 0.90,
      smoking_ok: 0.30,
      pets_ok: 0.50,
      luggage_large: 0.30,
      female_driver_pref: 0.20,
    },
  },
  {
    name: "smoker_relaxed",
    // Fumeur, peu de contraintes sur le reste
    prefs: {
      quiet_ride: 0.20,
      radio_ok: 0.50,
      smoking_ok: 0.90,
      pets_ok: 0.40,
      luggage_large: 0.30,
      female_driver_pref: 0.10,
    },
  },
  {
    name: "pet_owner",
    // Voyager avec animal = non-négociable
    prefs: {
      quiet_ride: 0.40,
      radio_ok: 0.40,
      smoking_ok: 0.10,
      pets_ok: 0.95,
      luggage_large: 0.50,
      female_driver_pref: 0.30,
    },
  },
  {
    name: "business_traveler",
    // Calme + grand coffre pour les bagages pro
    prefs: {
      quiet_ride: 0.80,
      radio_ok: 0.20,
      smoking_ok: 0.05,
      pets_ok: 0.10,
      luggage_large: 0.80,
      female_driver_pref: 0.50,
    },
  },
  {
    name: "female_safety",
    // Préfère fortement une conductrice
    prefs: {
      quiet_ride: 0.60,
      radio_ok: 0.40,
      smoking_ok: 0.05,
      pets_ok: 0.30,
      luggage_large: 0.30,
      female_driver_pref: 0.95,
    },
  },
  {
    name: "neutral",
    // Aucune préf marquée — profil de référence pour LightFM
    prefs: {
      quiet_ride: 0.40,
      radio_ok: 0.40,
      smoking_ok: 0.30,
      pets_ok: 0.40,
      luggage_large: 0.40,
      female_driver_pref: 0.30,
    },
  },
];

const PROFILE_NAMES = PASSENGER_PROFILES.map((p) => p.name);

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ── NOTE SCHEMA PRISMA ────────────────────────────────────────────────────────
// Avant de lancer ce seed, ajouter dans schema.prisma :
//
//   model Passenger {
//     ...
//     profile_type  String?  @default("neutral")
//     ...
//   }
//
// Puis : npx prisma migrate dev --name add_passenger_profile_type
// ─────────────────────────────────────────────────────────────────────────────

async function seedPassengers(count = 300) {
  console.log(`\n🚀 Création de ${count} passagers avec profils latents persistés...\n`);
  const hashedPassword = await bcrypt.hash("Test123!", 10);
  const passengers = [];

  for (let i = 1; i <= count; i++) {
    const sexe = i % 2 === 0 ? "F" : "M";
    const prenom = randomChoice(sexe === "F" ? PRENOMS_F : PRENOMS_M);

    // ✅ Bug P1+P3 FIX : round-robin sur les profils pour distribution équilibrée
    // On garantit ~43 passagers par profil (300 / 7 ≈ 43)
    const profile = PASSENGER_PROFILES[i % PASSENGER_PROFILES.length];

    passengers.push({
      email: `passenger${i}@mail.com`,
      password: hashedPassword,
      nom: randomChoice(NOMS),
      prenom,
      numTel: `0${randomInt(500000000, 799999999)}`,
      age: randomInt(18, 60),
      profile_type: profile.name,  // ✅ Bug P1 FIX : profil persisté en base
    });
  }

  try {
    let createdCount = 0;
    let updatedCount = 0;

    for (const passenger of passengers) {
      const existing = await prisma.passenger.findUnique({
        where: { email: passenger.email },
        select: { id: true, profile_type: true },
      });

      if (existing) {
        // ✅ Ne PAS écraser le profile_type si déjà assigné et pas "neutral"
        // → protège la cohérence des interactions déjà enregistrées
        const dataToUpdate = { ...passenger };
        if (existing.profile_type && existing.profile_type !== "neutral") {
          delete dataToUpdate.profile_type;
        }
        await prisma.passenger.update({
          where: { email: passenger.email },
          data: dataToUpdate,
        });
        updatedCount++;
      } else {
        await prisma.passenger.create({ data: passenger });
        createdCount++;
      }
    }

    console.log(`✅ ${createdCount} passagers créés`);
    console.log(`✅ ${updatedCount} passagers mis à jour\n`);

    // ── Résumé distribution profils ───────────────────────────────────────
    const sample = await prisma.passenger.findMany({
      select: { profile_type: true },
      take: count + 50,
    });

    console.log("📊 Distribution profils passagers (idéal ~14% par profil) :");
    for (const profileName of PROFILE_NAMES) {
      const nb = sample.filter((p) => p.profile_type === profileName).length;
      const pct = sample.length > 0 ? Math.round((nb / sample.length) * 100) : 0;
      const ok = pct >= 8 && pct <= 25 ? "✅" : "⚠️ ";
      console.log(`   ${profileName.padEnd(22)} : ${nb.toString().padStart(3)} (${pct}%)  ${ok}`);
    }
    console.log("\n💡 Si un profil > 30% : LightFM sera biaisé vers ce type.");
    console.log("   Si un profil < 5%  : LightFM ne pourra pas l'apprendre.\n");

  } catch (error) {
    console.error("❌ Erreur:", error.message);
    if (error.message.includes("profile_type")) {
      console.error("\n💡 Le champ profile_type n'existe pas dans Prisma.");
      console.error("   Ajouter dans schema.prisma :");
      console.error('   profile_type  String?  @default("neutral")');
      console.error("   Puis : npx prisma migrate dev --name add_passenger_profile_type\n");
    }
  } finally {
    await prisma.$disconnect();
  }
}

seedPassengers(300);

export { seedPassengers };
