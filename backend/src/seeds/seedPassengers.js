// seed.passengers.js
import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";

const PRENOMS = [
  "Ines", "Aya", "Yasmine", "Nour", "Lina", "Amel", "Imane", "Sonia", "Salma", "Maya",
  "Hawas", "Mohamed", "Yassine", "Karim", "Mehdi", "Hamza", "Rami", "Khaled", "Sofiane", "Amine",
];
const NOMS = ["Benali", "Mansouri", "Bouzid", "Belkacem", "Haddad", "Amrani", "Slimani", "Meziane"];

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function seedPassengers(count = 80) {
  console.log(`Creation de ${count} passagers...\n`);

  const hashedPassword = await bcrypt.hash("Test123!", 10);
  const passengers = [];

  for (let i = 1; i <= count; i++) {
    passengers.push({
      email: `passenger${i}@mail.com`,
      password: hashedPassword,
      nom: randomChoice(NOMS),
      prenom: randomChoice(PRENOMS),
      numTel: `0${randomInt(500000000, 799999999)}`,
      age: randomInt(18, 60),
    });
  }

  try {
    let createdCount = 0;
    let updatedCount = 0;

    for (const passenger of passengers) {
      const existing = await prisma.passenger.findUnique({
        where: { email: passenger.email },
        select: { id: true },
      });

      if (existing) {
        await prisma.passenger.update({
          where: { email: passenger.email },
          data: passenger,
        });
        updatedCount++;
      } else {
        await prisma.passenger.create({ data: passenger });
        createdCount++;
      }
    }

    console.log(`✅ ${createdCount} passagers crees avec succes!`);
    console.log(`✅ ${updatedCount} passagers mis a jour!`);
  } catch (error) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

seedPassengers(300);
