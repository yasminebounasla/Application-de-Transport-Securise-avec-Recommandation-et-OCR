// Script to create 3 test passengers in the database

import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";

const passengersData = [
  {
    nom: "Ali",
    prenom: "Karim",
    email: "passenger1@mail.com",
    age: 24,
    numTel: "1000000001",
    preferences: {
      quiet_ride: true,
      radio_ok: false,
      smoking_ok: false,
      pets_ok: true,
      luggage_large: false,
      female_driver_pref: false,
    },
  },
  {
    nom: "Sara",
    prenom: "Yasmine",
    email: "passenger2@mail.com",
    age: 28,
    numTel: "1000000002",
    preferences: {
      quiet_ride: false,
      radio_ok: true,
      smoking_ok: false,
      pets_ok: false,
      luggage_large: true,
      female_driver_pref: true,
    },
  },
  {
    nom: "Omar",
    prenom: "Hicham",
    email: "passenger3@mail.com",
    age: 26,
    numTel: "1000000003",
    preferences: {
      quiet_ride: true,
      radio_ok: true,
      smoking_ok: false,
      pets_ok: true,
      luggage_large: true,
      female_driver_pref: false,
    },
  },
];

const seedPassengers = async () => {
  try {
    for (let passenger of passengersData) {
      const hashedPassword = await bcrypt.hash("Password123!", 10);

      const createdPassenger = await prisma.passenger.create({
        data: {
          email: passenger.email,
          password: hashedPassword,
          nom: passenger.nom,
          prenom: passenger.prenom,
          age: passenger.age,
          numTel: passenger.numTel,
          ...passenger.preferences, // ajoute directement les préférences
        },
      });

      console.log(`✅ Passenger created: ${createdPassenger.email}`);
    }
  } catch (err) {
    console.error("❌ Error creating passengers:", err);
  } finally {
    await prisma.$disconnect();
  }
};

seedPassengers();
