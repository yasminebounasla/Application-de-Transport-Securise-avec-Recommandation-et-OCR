import { prisma } from "../config/prisma.js";

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)]; //prendre un element au hasard dans un tableau
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min; //prendre un entier au hasard entre min et max

async function seedTrajets() {

  const passengers = await prisma.passenger.findMany();
  const drivers = await prisma.driver.findMany();

  console.log(`Création des trajets avec historique réaliste...\n`);

  const trajets = [];
  const statuses = ['COMPLETED', 'CANCELLED_BY_PASSENGER','PENDING']; // on ajoute les 'pending' pour la realité du BD 

  for (const p of passengers) {
    const sampledDrivers = drivers.sort(() => 0.5 - Math.random()).slice(0, 10); // Prendre 10 drivers au hasard pour chaque passager
    // 0.5 - Math.random() permet de mélanger les driveres pour ne pas choisir les 10 premiers a chaque fois.

    for (const d of sampledDrivers) {
      const status = randomChoice(statuses);
      
      let baseRating = 3.5;
      if (p.quiet_ride && !d.talkative) baseRating += 0.5;
      if (!p.radio_ok && !d.radio_on) baseRating += 0.3;
      if (p.luggage_large && d.car_big) baseRating += 0.4;
      if (p.female_driver_pref && d.sexe === 'F') baseRating += 0.3;

      baseRating += (Math.random() * 1.0 - 0.5); // Ajouter un peu de bruit aléatoire
      baseRating = Math.max(1.0, Math.min(5.0, baseRating)); // S'assurer que la note est entre 1.0 et 5.0

      trajets.push({
        driverId: d.id,
        passagerId: p.id,
        startLat: 36 + Math.random(),
        startLng: 3 + Math.random(),
        startAddress: randomChoice(["Alger Centre", "Oran Ville", "Constantine Centre", "Annaba Ville"]),
        endLat: 35 + Math.random(),
        endLng: 4 + Math.random(),
        endAddress: randomChoice(["Blida Centre", "Tizi Ouzou Ville", "Bejaia Centre", "Sétif Ville"]),
        dateDepart: new Date(Date.now() - randomInt(0, 90) * 24 * 60 * 60 * 1000), // Date aléatoire dans les 90 derniers jours
        heureDepart: `${randomInt(6, 22)}:${randomChoice(['00', '15', '30', '45'])}`, // Heure de départ aléatoire entre 6h et 22h
        placesDispo: randomInt(1, 4),
        prix: parseFloat(randomInt(500, 2000).toFixed(2)), // Prix aléatoire entre 500 et 2000 DA
        status,
        rating: status === 'COMPLETED' ? parseFloat(baseRating.toFixed(1)) : null, // Note uniquement pour les trajets complétés
        completedAt: status === 'COMPLETED'
          ? new Date(Date.now() - randomInt(0, 90) * 24 * 60 * 60 * 1000)
          : null
      });
    }
  }

  try {
    const result = await prisma.trajet.createMany({ data: trajets, skipDuplicates: true });
    console.log(`${result.count} trajets créés avec succès !`);

  } catch (error) {
    console.error("❌ Erreur lors de l'insertion :", error);

  } finally {
    await prisma.$disconnect();
  }
}

seedTrajets().catch(err => {
  console.error("❌ Erreur :", err);
  process.exit(1);
});