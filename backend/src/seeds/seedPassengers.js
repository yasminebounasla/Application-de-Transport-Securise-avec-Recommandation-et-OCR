import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";

const PRENOMS = ["Ines", "Aya", "Yasmine", "Nour", "Lina", "Amel", "Imane", "Sonia", "Salma", "Maya"];
const NOMS = ["Benali", "Mansouri", "Bouzid", "Belkacem", "Haddad", "Amrani", "Slimani", "Meziane"];

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function seedPassengers(count = 80) {
  console.log(`Création de ${count} passagers...\n`);

  const hashedPassword = await bcrypt.hash("Test123!", 10);
  const passengers = [];

  for (let i = 1; i <= count; i++) {
    passengers.push({
      email: `passenger${i}@mail.com`,
      password: hashedPassword,
      nom: randomChoice(NOMS),
      prenom: randomChoice(PRENOMS),
      numTel: `0${randomInt(500000000, 799999999)}`,
      age: randomInt(18, 60)
      // ✅ Plus de colonnes de préférences inutiles
    });
  }

  await prisma.passenger.createMany({ data: passengers, skipDuplicates: true });
  console.log("Passagers créés !");
  await prisma.$disconnect();
}

seedPassengers();
