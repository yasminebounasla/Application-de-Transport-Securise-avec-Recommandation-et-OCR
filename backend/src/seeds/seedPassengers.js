import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";

const PRENOMS = ["Ines", "Aya", "Yasmine", "Nour", "Lina", "Amel", "Imane", "Sonia", "Salma", "Maya"];
const NOMS = ["Benali", "Mansouri", "Bouzid", "Belkacem", "Haddad", "Amrani", "Slimani", "Meziane"];

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)]; //prendre un element au hasard dans un tableau
const randomBool = () => Math.random() > 0.5; //prendre un booléen au hasard (true ou false)
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min; //prendre un entier au hasard entre min et max

async function seedPassengers(count = 80) {
  console.log(` Création de ${count} passagers...\n`);

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

      quiet_ride: randomBool(),
      radio_ok: randomBool(),
      smoking_ok: randomBool(),
      pets_ok: randomBool(),
      luggage_large: randomBool(),
      female_driver_pref: randomBool(),
    });
  }

  await prisma.passenger.createMany({ data: passengers, skipDuplicates: true });
  console.log(" Passengers créés !");
  await prisma.$disconnect();
}

seedPassengers();
