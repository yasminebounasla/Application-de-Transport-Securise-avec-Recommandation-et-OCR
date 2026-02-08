import { prisma } from "../config/prisma.js";

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function seedTrajets() {
  console.log("🔍 DEBUG : Vérification des données...\n");

  // 1️⃣ Vérifier les passengers
  const passengers = await prisma.passenger.findMany();
  console.log(`👥 Passengers trouvés : ${passengers.length}`);
  if (passengers.length > 0) {
    console.log(`   Exemple : ID=${passengers[0].id}, Nom=${passengers[0].nom}\n`);
  } else {
    console.log("❌ AUCUN PASSENGER ! Lance d'abord : node src/seeds/seedPassengers.js\n");
    await prisma.$disconnect();
    process.exit(1);
  }

  // 2️⃣ Vérifier les drivers
  const drivers = await prisma.driver.findMany();
  console.log(`🚗 Drivers trouvés : ${drivers.length}`);
  if (drivers.length > 0) {
    console.log(`   Exemple : ID=${drivers[0].id}, Nom=${drivers[0].prenom}\n`);
  } else {
    console.log("❌ AUCUN DRIVER ! Lance d'abord : node src/seeds/seedDrivers.js\n");
    await prisma.$disconnect();
    process.exit(1);
  }

  // 3️⃣ Créer les trajets
  console.log("🚀 Création des trajets avec historique réaliste...\n");

  const trajets = [];
  const statuses = ['COMPLETED', 'CANCELLED_BY_PASSENGER', 'PENDING'];

  for (const p of passengers) {
    const sampledDrivers = drivers.sort(() => 0.5 - Math.random()).slice(0, 10);

    for (const d of sampledDrivers) {
      const status = randomChoice(statuses);
      
      let baseRating = 3.5;
      
      if (p.quiet_ride && !d.talkative) baseRating += 0.5;
      if (!p.radio_ok && !d.radio_on) baseRating += 0.3;
      if (p.luggage_large && d.car_big) baseRating += 0.4;
      if (p.female_driver_pref && d.sexe === 'F') baseRating += 0.3;
      
      baseRating += (Math.random() * 1.0 - 0.5);
      baseRating = Math.max(1.0, Math.min(5.0, baseRating));

      trajets.push({
        driverId: d.id,
        passagerId: p.id,
        depart: randomChoice(["Alger", "Oran", "Constantine", "Annaba"]),
        destination: randomChoice(["Blida", "Tizi Ouzou", "Bejaia", "Sétif"]),
        dateDepart: new Date(Date.now() - randomInt(0, 90) * 24 * 60 * 60 * 1000),
        heureDepart: `${randomInt(6, 22)}:${randomChoice(['00', '15', '30', '45'])}`,
        placesDispo: randomInt(1, 4),
        prix: randomInt(500, 2000),
        status: status,
        rating: status === 'COMPLETED' ? parseFloat(baseRating.toFixed(1)) : null,
        completedAt: status === 'COMPLETED' ? new Date(Date.now() - randomInt(0, 90) * 24 * 60 * 60 * 1000) : null
      });
    }
  }

  console.log(`📦 ${trajets.length} trajets prêts à être insérés...\n`);

  if (trajets.length === 0) {
    console.log("❌ Aucun trajet à créer !");
    await prisma.$disconnect();
    process.exit(1);
  }

  // 4️⃣ Insertion dans la BD
  try {
    const result = await prisma.trajet.createMany({ 
      data: trajets,
      skipDuplicates: true 
    });

    console.log(`✅ ${result.count} trajets insérés dans la BD !`);
    console.log(`📊 Répartition :`);
    console.log(`   - Completed: ${trajets.filter(t => t.status === 'COMPLETED').length}`);
    console.log(`   - Cancelled: ${trajets.filter(t => t.status === 'CANCELLED_BY_PASSENGER').length}`);
    console.log(`   - Pending: ${trajets.filter(t => t.status === 'PENDING').length}`);

  } catch (error) {
    console.error("❌ Erreur lors de l'insertion :", error);
    await prisma.$disconnect();
    process.exit(1);
  }

  await prisma.$disconnect();
  process.exit(0);
}

seedTrajets().catch(err => {
  console.error("❌ Erreur fatale :", err);
  process.exit(1);
});