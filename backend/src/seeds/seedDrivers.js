// seed.drivers.js
// ✅ 200 drivers : ~75 à Alger (test jury), ~125 répartis sur autres wilayas

import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";

const PRENOMS_F = ["Sara", "Lina", "Amira", "Nour", "Yasmine", "Fatima", "Meriem", "Salma", "Rania", "Asma"];
const PRENOMS_M = ["Hawas", "Mohamed", "Yassine", "Karim", "Mehdi", "Hamza", "Rami", "Khaled", "Sofiane", "Amine"];
const NOMS = ["Benali", "Mansouri", "Bouzid", "Belkacem", "Haddad", "Amrani", "Slimani", "Meziane", "Bouaziz", "Cherif"];

// ✅ Wilayas avec coordonnées GPS réelles
// Alger a un poids de 75/200 = 37.5% des drivers
// Les autres wilayas se partagent le reste
const WILAYAS_WEIGHTED = [
  // Alger : 75 drivers sur 200
  ...Array(75).fill({ wilaya: "Alger", lat: 36.7538, lng: 3.0588 }),

  // Autres wilayas : 125 drivers répartis
  ...Array(15).fill({ wilaya: "Oran",        lat: 35.6969, lng: 0.6331  }),
  ...Array(12).fill({ wilaya: "Constantine", lat: 36.3650, lng: 6.6147  }),
  ...Array(12).fill({ wilaya: "Blida",       lat: 36.4700, lng: 2.8300  }),
  ...Array(10).fill({ wilaya: "Annaba",      lat: 36.9000, lng: 7.7667  }),
  ...Array(10).fill({ wilaya: "Sétif",       lat: 36.1898, lng: 5.4108  }),
  ...Array(12).fill({ wilaya: "Béjaïa",      lat: 36.7515, lng: 5.0564  }),
  ...Array(15).fill({ wilaya: "Tizi Ouzou",  lat: 36.7169, lng: 4.0497  }),
  ...Array(14).fill({ wilaya: "Médéa",       lat: 36.2636, lng: 2.7539  }),
  ...Array(15).fill({ wilaya: "Boumerdès",   lat: 36.7667, lng: 3.4667  }),
  // Total autres : 15+12+12+10+10+12+15+14+15 = 125 ✅
];

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomBool   = ()    => Math.random() > 0.5;
const randomInt    = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat  = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(6));

async function seedDrivers() {
  const count = WILAYAS_WEIGHTED.length; // 200
  console.log(`\n🚀 Création de ${count} drivers...`);
  console.log(`   📍 Alger    : 75  drivers`);
  console.log(`   🗺️  Autres   : 125 drivers\n`);

  // Nettoyer les anciens drivers
  console.log("🗑️  Suppression des anciens drivers...");
  await prisma.driver.deleteMany({});
  console.log("✅ Nettoyé\n");

  const hashedPassword = await bcrypt.hash("Test123!", 10);
  const drivers = [];

  for (let i = 0; i < count; i++) {
    const sexe   = i % 2 === 0 ? "F" : "M";
    const prenom = randomChoice(sexe === "F" ? PRENOMS_F : PRENOMS_M);
    const nom    = randomChoice(NOMS);

    // Wilaya depuis le tableau pondéré
    const wilayaData = WILAYAS_WEIGHTED[i];

    // Légère variation GPS autour du centre de la wilaya (±0.05° ≈ ±5.5km)
    const latitude  = wilayaData.lat + randomFloat(-0.05, 0.05);
    const longitude = wilayaData.lng + randomFloat(-0.05, 0.05);

    drivers.push({
      email:    `driver${i + 1}@mail.com`,
      password: hashedPassword,
      nom,
      prenom,
      numTel: `0${randomInt(500000000, 799999999)}`,
      sexe,
      age:        randomInt(22, 55),
      isVerified: true,
      hasAcceptedPhotoStorage: true,

      // Localisation
      wilaya:    wilayaData.wilaya,
      latitude,
      longitude,

      // Features LightFM — aléatoires mais cohérentes
      talkative:       randomBool(),
      radio_on:        randomBool(),
      smoking_allowed: randomBool(),
      pets_allowed:    randomBool(),
      car_big:         randomBool(),

      // Disponibilités horaires — chaque driver couvre 2-3 plages
      works_morning:   Math.random() > 0.35,
      works_afternoon: Math.random() > 0.35,
      works_evening:   Math.random() > 0.50,
      works_night:     Math.random() > 0.75,
    });
  }

  try {
    const result = await prisma.driver.createMany({
      data: drivers,
      skipDuplicates: true,
    });

    console.log(`✅ ${result.count} drivers créés avec succès!\n`);

    // Vérification de la répartition
    const algerDrivers = await prisma.driver.count({ where: { wilaya: "Alger" } });
    const totalDrivers = await prisma.driver.count();

    console.log(`📊 Répartition finale :`);
    console.log(`   Alger   : ${algerDrivers} drivers`);
    console.log(`   Autres  : ${totalDrivers - algerDrivers} drivers`);
    console.log(`   Total   : ${totalDrivers} drivers\n`);

    // Exemples
    const samples = await prisma.driver.findMany({ take: 6 });
    console.log("Exemples de drivers créés:");
    samples.forEach((d) => {
      console.log(
        `  - ${d.prenom} ${d.nom} (${d.sexe}) | ${d.wilaya} | ` +
        `lat: ${d.latitude?.toFixed(4)}, lng: ${d.longitude?.toFixed(4)} | ` +
        `talkative: ${d.talkative}`
      );
    });

  } catch (error) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

seedDrivers();