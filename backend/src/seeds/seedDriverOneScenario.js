import { prisma } from "../config/prisma.js";

const DRIVER_ID = 1;
const route = (
  depart,
  destination,
  startLat,
  startLng,
  endLat,
  endLng,
) => ({
  depart,
  destination,
  startAddress: depart,
  endAddress: destination,
  startLat,
  startLng,
  endLat,
  endLng,
});

const COMPLETED_TRIPS = [
  {
    passengerId: 2,
    dateDepart: new Date("2026-01-08T07:30:00.000Z"),
    heureDepart: "08:30",
    prix: 320,
    placesDispo: 2,
    completedAt: new Date("2026-01-08T08:15:00.000Z"),
    quiet_ride: "yes",
    radio_ok: "no",
    smoking_ok: "no",
    pets_ok: "no",
    luggage_large: "yes",
    female_driver_pref: "no",
    ...route("Bab Ezzouar", "Alger Centre", 36.7139, 3.2146, 36.7538, 3.0588),
  },
  {
    passengerId: 3,
    dateDepart: new Date("2026-01-22T16:00:00.000Z"),
    heureDepart: "17:00",
    prix: 410,
    placesDispo: 3,
    completedAt: new Date("2026-01-22T17:40:00.000Z"),
    quiet_ride: "no",
    radio_ok: "yes",
    smoking_ok: "no",
    pets_ok: "no",
    luggage_large: "yes",
    female_driver_pref: "no",
    ...route("Kouba", "Hydra", 36.7167, 3.1333, 36.7440, 3.0419),
  },
  {
    passengerId: 4,
    dateDepart: new Date("2026-02-11T11:00:00.000Z"),
    heureDepart: "12:00",
    prix: 280,
    placesDispo: 1,
    completedAt: new Date("2026-02-11T12:35:00.000Z"),
    quiet_ride: "yes",
    radio_ok: "no",
    smoking_ok: "no",
    pets_ok: "yes",
    luggage_large: "no",
    female_driver_pref: "yes",
    ...route("El Harrach", "Hussein Dey", 36.7197, 3.1833, 36.7272, 3.0939),
  },
  {
    passengerId: 5,
    dateDepart: new Date("2026-03-07T17:30:00.000Z"),
    heureDepart: "18:30",
    prix: 530,
    placesDispo: 3,
    completedAt: new Date("2026-03-07T19:20:00.000Z"),
    quiet_ride: "no",
    radio_ok: "yes",
    smoking_ok: "no",
    pets_ok: "yes",
    luggage_large: "yes",
    female_driver_pref: "no",
    ...route("Bir Mourad Rais", "Ain Benian", 36.7069, 3.0514, 36.7631, 2.9997),
  },
  {
    passengerId: 6,
    dateDepart: new Date("2026-03-28T13:00:00.000Z"),
    heureDepart: "14:00",
    prix: 360,
    placesDispo: 2,
    completedAt: new Date("2026-03-28T14:45:00.000Z"),
    quiet_ride: "yes",
    radio_ok: "yes",
    smoking_ok: "no",
    pets_ok: "no",
    luggage_large: "no",
    female_driver_pref: "yes",
    ...route("El Madania", "Alger Centre", 36.7378, 3.1108, 36.7538, 3.0588),
  },
  {
    passengerId: 7,
    dateDepart: new Date("2026-04-14T08:00:00.000Z"),
    heureDepart: "09:00",
    prix: 300,
    placesDispo: 2,
    completedAt: new Date("2026-04-14T09:40:00.000Z"),
    quiet_ride: "yes",
    radio_ok: "no",
    smoking_ok: "no",
    pets_ok: "yes",
    luggage_large: "yes",
    female_driver_pref: "no",
    ...route("Hydra", "Ben Aknoun", 36.7440, 3.0419, 36.7562, 3.0136),
  },
];

const createPendingDate = (minutesFromNow) => {
  const date = new Date(Date.now() + minutesFromNow * 60 * 1000);
  return {
    dateDepart: date,
    heureDepart: `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes(),
    ).padStart(2, "0")}`,
  };
};

const PENDING_TRIPS = [
  {
    passengerId: 8,
    prix: 260,
    placesDispo: 1,
    dateDepart: new Date("2026-04-23T11:00:00.000Z"),
    heureDepart: "12:00",
    ...route("Cheraga", "Dely Ibrahim", 36.7676, 2.9590, 36.7515, 2.9838),
  },
  {
    passengerId: 9,
    prix: 340,
    placesDispo: 2,
    dateDepart: new Date("2026-04-24T09:30:00.000Z"),
    heureDepart: "10:30",
    ...route("Birkhadem", "El Biar", 36.7146, 3.0502, 36.7579, 3.0387),
  },
  {
    passengerId: 10,
    prix: 450,
    placesDispo: 3,
    dateDepart: new Date("2026-04-23T14:00:00.000Z"),
    heureDepart: "15:00",
    ...route("Draria", "Bab El Oued", 36.7174, 2.9496, 36.7456, 3.0231),
  },
];

const ACCEPTED_TRIPS = [
  {
    passengerId: 8,
    prix: 260,
    placesDispo: 1,
    ...createPendingDate(25),
    ...route("Cheraga", "Dely Ibrahim", 36.7676, 2.9590, 36.7515, 2.9838),
  },
  {
    passengerId: 9,
    prix: 340,
    placesDispo: 2,
    ...createPendingDate(50),
    ...route("Birkhadem", "El Biar", 36.7146, 3.0502, 36.7579, 3.0387),
  },
];

const IN_PROGRESS_TRIP = {
  passengerId: 1,
  dateDepart: new Date(Date.now() - 30 * 60 * 1000),
  heureDepart: `${String(new Date().getHours()).padStart(2, "0")}:${String(
    new Date().getMinutes(),
  ).padStart(2, "0")}`,
  prix: 390,
  placesDispo: 1,
  status: "IN_PROGRESS",
  createdAt: new Date(Date.now() - 90 * 60 * 1000),
  updatedAt: new Date(),
  ...route("Alger Centre", "Kouba", 36.7538, 3.0588, 36.7167, 3.1333),
};

async function seedDriverOneScenario() {
  try {
    const driver = await prisma.driver.findUnique({ where: { id: DRIVER_ID } });
    if (!driver) {
      throw new Error(`Driver ${DRIVER_ID} not found.`);
    }

    const passengerIds = [
      ...new Set([
        ...COMPLETED_TRIPS.map((trip) => trip.passengerId),
        ...PENDING_TRIPS.map((trip) => trip.passengerId),
        ...ACCEPTED_TRIPS.map((trip) => trip.passengerId),
        IN_PROGRESS_TRIP.passengerId,
      ]),
    ];
    const passengers = await prisma.passenger.findMany({
      where: { id: { in: passengerIds } },
      select: { id: true },
    });

    if (passengers.length !== passengerIds.length) {
      throw new Error("Some required passengers for the demo scenario are missing.");
    }

    await prisma.driver.update({
      where: { id: DRIVER_ID },
      data: {
        createdAt: new Date("2025-12-19T09:00:00.000Z"),
      },
    });

    await prisma.evaluation.deleteMany({
      where: {
        trajet: {
          driverId: DRIVER_ID,
        },
      },
    });

    await prisma.trajet.deleteMany({
      where: {
        driverId: DRIVER_ID,
      },
    });

    const createdCompleted = [];
    for (const trip of COMPLETED_TRIPS) {
      const createdAt = new Date(trip.dateDepart.getTime() - 45 * 60 * 1000);
      const trajet = await prisma.trajet.create({
        data: {
          driverId: DRIVER_ID,
          passagerId: trip.passengerId,
          depart: trip.depart,
          destination: trip.destination,
          startAddress: trip.startAddress,
          endAddress: trip.endAddress,
          startLat: trip.startLat,
          startLng: trip.startLng,
          endLat: trip.endLat,
          endLng: trip.endLng,
          dateDepart: trip.dateDepart,
          heureDepart: trip.heureDepart,
          placesDispo: trip.placesDispo,
          prix: trip.prix,
          status: "COMPLETED",
          quiet_ride: trip.quiet_ride,
          radio_ok: trip.radio_ok,
          smoking_ok: trip.smoking_ok,
          pets_ok: trip.pets_ok,
          luggage_large: trip.luggage_large,
          female_driver_pref: trip.female_driver_pref,
          createdAt,
          updatedAt: trip.completedAt,
          completedAt: trip.completedAt,
        },
      });
      createdCompleted.push(trajet);

      await prisma.evaluation.create({
        data: {
          trajetId: trajet.id,
          rating: 4.5,
          comment: "Completed seed ride",
        },
      });
    }

    for (const trip of PENDING_TRIPS) {
      const createdAt = new Date(trip.dateDepart.getTime() - 20 * 60 * 1000);
      await prisma.trajet.create({
        data: {
          driverId: DRIVER_ID,
          passagerId: trip.passengerId,
          depart: trip.depart,
          destination: trip.destination,
          startAddress: trip.startAddress,
          endAddress: trip.endAddress,
          startLat: trip.startLat,
          startLng: trip.startLng,
          endLat: trip.endLat,
          endLng: trip.endLng,
          dateDepart: trip.dateDepart,
          heureDepart: trip.heureDepart,
          placesDispo: trip.placesDispo,
          prix: trip.prix,
          status: "PENDING",
          createdAt,
          updatedAt: createdAt,
        },
      });
    }

    for (const trip of ACCEPTED_TRIPS) {
      const createdAt = new Date(trip.dateDepart.getTime() - 25 * 60 * 1000);
      await prisma.trajet.create({
        data: {
          driverId: DRIVER_ID,
          passagerId: trip.passengerId,
          depart: trip.depart,
          destination: trip.destination,
          startAddress: trip.startAddress,
          endAddress: trip.endAddress,
          startLat: trip.startLat,
          startLng: trip.startLng,
          endLat: trip.endLat,
          endLng: trip.endLng,
          dateDepart: trip.dateDepart,
          heureDepart: trip.heureDepart,
          placesDispo: trip.placesDispo,
          prix: trip.prix,
          status: "ACCEPTED",
          createdAt,
          updatedAt: createdAt,
        },
      });
    }

    await prisma.trajet.create({
      data: {
        driverId: DRIVER_ID,
        passagerId: IN_PROGRESS_TRIP.passengerId,
        depart: IN_PROGRESS_TRIP.depart,
        destination: IN_PROGRESS_TRIP.destination,
        startAddress: IN_PROGRESS_TRIP.startAddress,
        endAddress: IN_PROGRESS_TRIP.endAddress,
        startLat: IN_PROGRESS_TRIP.startLat,
        startLng: IN_PROGRESS_TRIP.startLng,
        endLat: IN_PROGRESS_TRIP.endLat,
        endLng: IN_PROGRESS_TRIP.endLng,
        dateDepart: IN_PROGRESS_TRIP.dateDepart,
        heureDepart: IN_PROGRESS_TRIP.heureDepart,
        placesDispo: IN_PROGRESS_TRIP.placesDispo,
        prix: IN_PROGRESS_TRIP.prix,
        status: "IN_PROGRESS",
        createdAt: IN_PROGRESS_TRIP.createdAt,
        updatedAt: IN_PROGRESS_TRIP.updatedAt,
      },
    });

    console.log(
      `Seeded driver ${DRIVER_ID}: ${COMPLETED_TRIPS.length} completed, ${PENDING_TRIPS.length} requests, ${ACCEPTED_TRIPS.length} accepted, 1 in-progress trip.`,
    );
  } catch (error) {
    console.error("Failed to seed driver scenario:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

seedDriverOneScenario();
