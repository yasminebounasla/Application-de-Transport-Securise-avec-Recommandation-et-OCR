// seed.drivers.js
import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";

const PRENOMS_F = ["Sara", "Lina", "Amira", "Nour", "Yasmine", "Fatima", "Meriem", "Salma", "Rania", "Asma"];
const PRENOMS_M = ["Hawas", "Mohamed", "Yassine", "Karim", "Mehdi", "Hamza", "Rami", "Khaled", "Sofiane", "Amine"];
const NOMS = ["Benali", "Mansouri", "Bouzid", "Belkacem", "Haddad", "Amrani", "Slimani", "Meziane", "Bouaziz", "Cherif"];

// ✅ Vraies coordonnées GPS des wilayas algériennes
const WILAYAS = [
  { wilaya: "Alger",      lat: 36.7538, lng: 3.0588 },
  { wilaya: "Oran",       lat: 35.6969, lng: 0.6331 },
  { wilaya: "Constantine",lat: 36.3650, lng: 6.6147 },
  { wilaya: "Blida",      lat: 36.4700, lng: 2.8300 },
  { wilaya: "Annaba",     lat: 36.9000, lng: 7.7667 },
  { wilaya: "Sétif",      lat: 36.1898, lng: 5.4108 },
  { wilaya: "Béjaïa",     lat: 36.7515, lng: 5.0564 },
  { wilaya: "Tizi Ouzou", lat: 36.7169, lng: 4.0497 },
  { wilaya: "Médéa",      lat: 36.2636, lng: 2.7539 },
  { wilaya: "Boumerdès",  lat: 36.7667, lng: 3.4667 },
];

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomBool = () => Math.random() > 0.5;
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(6));

async function seedDrivers(count = 30) {
  console.log(`Création de ${count} drivers...\n`);
  const hashedPassword = await bcrypt.hash("Test123!", 10);
  const drivers = [];

  for (let i = 1; i <= count; i++) {
    const sexe = i % 2 === 0 ? "F" : "M";
    const prenom = randomChoice(sexe === "F" ? PRENOMS_F : PRENOMS_M);
    const nom = randomChoice(NOMS);

    // ✅ Wilaya avec coordonnées GPS réalistes (légère variation autour du centre)
    const wilayaData = randomChoice(WILAYAS);
    const latitude  = wilayaData.lat + randomFloat(-0.05, 0.05);
    const longitude = wilayaData.lng + randomFloat(-0.05, 0.05);

    drivers.push({
      email:    `driver${i}@mail.com`,
      password: hashedPassword,
      nom,
      prenom,
      numTel: `0${randomInt(500000000, 799999999)}`,
      sexe,
      age:        randomInt(22, 55),
      isVerified: true,
      hasAcceptedPhotoStorage: true,

      // ✅ Wilaya + coordonnées GPS
      wilaya:    wilayaData.wilaya,
      latitude,
      longitude,

      // ✅ Features LightFM
      talkative:       randomBool(),
      radio_on:        randomBool(),
      smoking_allowed: randomBool(),
      pets_allowed:    randomBool(),
      car_big:         randomBool(),
      works_morning:   randomBool(),
      works_afternoon: randomBool(),
      works_evening:   randomBool(),
      works_night:     randomBool(),
    });
  }

  try {
    const result = await prisma.driver.createMany({
      data: drivers,
      skipDuplicates: true,
    });
    console.log(`✅ ${result.count} drivers créés avec succès!\n`);

    const created = await prisma.driver.findMany({ take: 5 });
    console.log("Exemples de drivers créés:");
    created.forEach((d) => {
      console.log(
        `  - ${d.prenom} ${d.nom} (${d.sexe}) | ${d.wilaya} | lat: ${d.latitude?.toFixed(4)}, lng: ${d.longitude?.toFixed(4)} | talkative: ${d.talkative}`
      );
    });
  } catch (error) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

seedDrivers(30);