// create a script to add 10 drivers to the database for testing recommendation system

import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";

const driversData = [
  { nom: "Ahmed", prenom: "Ali", email: "driver1@mail.com", age: 25, numTel: "1234567890", sexe: "M" },
  { nom: "Sara", prenom: "Ben", email: "driver2@mail.com", age: 30, numTel: "2345678901", sexe: "F" },
  { nom: "Khaled", prenom: "Yassine", email: "driver3@mail.com", age: 28, numTel: "3456789012", sexe: "M" },
  { nom: "Lina", prenom: "Hanna", email: "driver4@mail.com", age: 27, numTel: "4567890123", sexe: "F" },
  { nom: "Mohamed", prenom: "Rami", email: "driver5@mail.com", age: 35, numTel: "5678901234", sexe: "M" },
  { nom: "Yasmine", prenom: "Nour", email: "driver6@mail.com", age: 26, numTel: "6789012345", sexe: "F" },
  { nom: "Walid", prenom: "Tarek", email: "driver7@mail.com", age: 29, numTel: "7890123456", sexe: "M" },
  { nom: "Rania", prenom: "Salma", email: "driver8@mail.com", age: 31, numTel: "8901234567", sexe: "F" },
  { nom: "Omar", prenom: "Hicham", email: "driver9@mail.com", age: 33, numTel: "9012345678", sexe: "M" },
  { nom: "Maya", prenom: "Lila", email: "driver10@mail.com", age: 24, numTel: "0123456789", sexe: "F" },
];

const seedDrivers = async () => {
  try {
    for (let driver of driversData) {
      const hashedPassword = await bcrypt.hash("Password123!", 10);

      const createdDriver = await prisma.driver.create({
        data: {
          email: driver.email,
          password: hashedPassword,
          nom: driver.nom,
          prenom: driver.prenom,
          age: driver.age,
          numTel: driver.numTel,
          sexe: driver.sexe,
          fumeur: Math.random() < 0.5,
          talkative: Math.random() < 0.5,
          radio_on: Math.random() < 0.5,
          smoking_allowed: Math.random() < 0.5,
          pets_allowed: Math.random() < 0.5,
          car_big: Math.random() < 0.5,
          works_morning: Math.random() < 0.5,
          works_afternoon: Math.random() < 0.5,
          works_evening: Math.random() < 0.5,
          works_night: Math.random() < 0.5,
          isVerified: true,
        },
      });

      console.log(`✅ Driver created: ${createdDriver.email}`);
    }
  } catch (err) {
    console.error("❌ Error creating drivers:", err);
  } finally {
    await prisma.$disconnect();
  }
};

seedDrivers();
