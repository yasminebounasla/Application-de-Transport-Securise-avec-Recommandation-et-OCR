import { prisma } from "../config/prisma.js";

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function seedTrajets() {
  const passengers = await prisma.passenger.findMany();
  const drivers = await prisma.driver.findMany();

  console.log("Création des trajets...");

  const trajets = [];

  for (const p of passengers) {
    const sampledDrivers = drivers.sort(() => 0.5 - Math.random()).slice(0, 10);

    for (const d of sampledDrivers) {
      trajets.push({
        driverId: d.id,
        passagerId: p.id,
        depart: "Alger",
        destination: "Blida",
        dateDepart: new Date(),
        heureDepart: "08:00",
        placesDispo: randomInt(1, 4),
        prix: randomInt(500, 2000),
      });
    }
  }

  await prisma.trajet.createMany({ data: trajets });
  console.log(` ${trajets.length} trajets créés !`);
  await prisma.$disconnect();
}

seedTrajets();
