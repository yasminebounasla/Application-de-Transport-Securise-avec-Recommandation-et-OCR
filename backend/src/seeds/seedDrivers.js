// seed.drivers.js
import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";

const PRENOMS_F = ["Sara", "Lina", "Amira", "Nour", "Yasmine", "Fatima", "Meriem", "Salma", "Rania", "Asma"];
const PRENOMS_M = ["Hawas", "Mohamed", "Yassine", "Karim", "Mehdi", "Hamza", "Rami", "Khaled", "Sofiane", "Amine"];
const NOMS = ["Benali", "Mansouri", "Bouzid", "Belkacem", "Haddad", "Amrani", "Slimani", "Meziane", "Bouaziz", "Cherif"];

const ALGER_ZONES = [
  { lat: 36.7538, lng: 3.0588 },
  { lat: 36.7197, lng: 3.1833 },
  { lat: 36.7456, lng: 3.0231 },
  { lat: 36.7631, lng: 2.9997 },
  { lat: 36.7272, lng: 3.0939 },
  { lat: 36.7167, lng: 3.1333 },
  { lat: 36.6961, lng: 3.2150 },
  { lat: 36.7069, lng: 3.0514 },
  { lat: 36.7378, lng: 3.1108 },
  { lat: 36.7406, lng: 3.1856 },
  { lat: 36.7333, lng: 3.2833 },
  { lat: 36.7167, lng: 3.3500 },
  { lat: 36.7667, lng: 2.9667 },
  { lat: 36.7500, lng: 2.8833 },
  { lat: 36.6833, lng: 2.8333 },
];

const AUTRES_WILAYAS = [
  { wilaya: "Oran",        lat: 35.6969, lng: 0.6331 },
  { wilaya: "Constantine", lat: 36.3650, lng: 6.6147 },
  { wilaya: "Blida",       lat: 36.4700, lng: 2.8300 },
  { wilaya: "Annaba",      lat: 36.9000, lng: 7.7667 },
  { wilaya: "Bejaia",      lat: 36.7515, lng: 5.0564 },
];

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomBool   = () => Math.random() > 0.5;
const randomInt    = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat  = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(6));

async function seedDrivers(count = 100) {
  console.log(`Création de ${count} drivers (80 Alger + 20 autres wilayas)...\n`);
  const hashedPassword = await bcrypt.hash("Test123!", 10);
  const drivers = [];

  for (let i = 1; i <= count; i++) {
    const sexe   = i % 2 === 0 ? "F" : "M";
    const prenom = randomChoice(sexe === "F" ? PRENOMS_F : PRENOMS_M);
    const nom    = randomChoice(NOMS);

    let wilaya, latitude, longitude;

    if (i <= 80) {
      const zone = randomChoice(ALGER_ZONES);
      wilaya    = "Alger";
      latitude  = zone.lat + randomFloat(-0.02, 0.02);
      longitude = zone.lng + randomFloat(-0.02, 0.02);
    } else {
      const w   = randomChoice(AUTRES_WILAYAS);
      wilaya    = w.wilaya;
      latitude  = w.lat + randomFloat(-0.05, 0.05);
      longitude = w.lng + randomFloat(-0.05, 0.05);
    }

    drivers.push({
      email:                   `driver${i}@mail.com`,
      password:                hashedPassword,
      nom,
      prenom,
      numTel:                  `0${randomInt(500000000, 799999999)}`,
      sexe,
      age:                     randomInt(22, 55),
      isVerified:              true,
      hasAcceptedPhotoStorage: true,
      wilaya,
      latitude,
      longitude,
      talkative:               randomBool(),
      radio_on:                randomBool(),
      smoking_allowed:         randomBool(),
      pets_allowed:            randomBool(),
      car_big:                 randomBool(),
      works_morning:           randomBool(),
      works_afternoon:         randomBool(),
      works_evening:           randomBool(),
      works_night:             randomBool(),
      avgRating:               parseFloat((randomFloat(3.0, 5.0)).toFixed(1)),
      ratingsCount:            randomInt(5, 150),
    });
  }

  try {
    let createdCount = 0;
    let updatedCount = 0;

    for (const driver of drivers) {
      const existing = await prisma.driver.findUnique({
        where:  { email: driver.email },
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

    const exemples = await prisma.driver.findMany({ take: 5 });
    console.log("Exemples de drivers:");
    exemples.forEach((d) => {
      console.log(
        `  - ${d.prenom} ${d.nom} (${d.sexe}) | ${d.wilaya} | lat: ${d.latitude?.toFixed(4)}, lng: ${d.longitude?.toFixed(4)}`
      );
    });
  } catch (error) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

seedDrivers(100);