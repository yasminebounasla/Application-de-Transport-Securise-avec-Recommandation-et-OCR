import { prisma } from "../config/prisma.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const boolToYesNo = (b) => (b ? "yes" : "no");

async function exportLightFM() {
  console.log("🚀 Export LightFM avec données RÉELLES...\n");

  try {
    // 1️⃣ Récupérer tous les passagers et drivers
    const passengers = await prisma.passenger.findMany();
    const drivers = await prisma.driver.findMany();

    console.log(`👥 ${passengers.length} passagers trouvés`);
    console.log(`🚗 ${drivers.length} drivers trouvés\n`);

    // 2️⃣ Récupérer les VRAIS trajets (completed ou cancelled par passager)
    const trajets = await prisma.trajet.findMany({
      where: {
        status: {
          in: ['COMPLETED', 'CANCELLED_BY_PASSENGER']
        }
      },
      include: {
        passenger: true,
        driver: true
      }
    });

    console.log(`📊 ${trajets.length} trajets réels trouvés dans la BD`);

    // 3️⃣ Créer les interactions avec WEIGHT RÉEL
    const interactions = trajets
      .filter(t => t.passagerId !== null)
      .map(t => {
        let weight = 0.0;

        if (t.status === 'CANCELLED_BY_PASSENGER') {
          weight = 0.2;
        } else if (t.status === 'COMPLETED') {
          if (t.rating === null) {
            weight = 0.5;
          } else if (t.rating >= 4.5) {
            weight = 1.0;
          } else if (t.rating >= 4.0) {
            weight = 0.8;
          } else if (t.rating >= 3.5) {
            weight = 0.6;
          } else if (t.rating >= 3.0) {
            weight = 0.4;
          } else {
            weight = 0.2;
          }
        }

        return {
          passenger_id: `P${t.passagerId}`,
          driver_id: `D${t.driverId}`,
          weight: weight.toFixed(4),
          date_trajet: t.completedAt || t.createdAt
        };
      });

    console.log(`✅ ${interactions.length} interactions créées`);
    console.log(`📈 Distribution des weights :`);
    const w1 = interactions.filter(i => parseFloat(i.weight) >= 0.8).length;
    const w2 = interactions.filter(i => parseFloat(i.weight) >= 0.4 && parseFloat(i.weight) < 0.8).length;
    const w3 = interactions.filter(i => parseFloat(i.weight) < 0.4).length;
    console.log(`   - Excellents (≥0.8): ${w1}`);
    console.log(`   - Moyens (0.4-0.8): ${w2}`);
    console.log(`   - Mauvais (<0.4): ${w3}\n`);

    if (interactions.length === 0) {
      console.log("❌ AUCUNE interaction trouvée !");
      console.log("❌ Lance d'abord : node src/seeds/seedTrajets.js\n");
      await prisma.$disconnect();
      process.exit(1);
    }

    // 4️⃣ EXPORT CSV
    const exportDir = path.join(process.cwd(), "../ml-service/lightfm_data");
    
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
      console.log(`📁 Dossier créé : ${exportDir}\n`);
    }

    // PASSENGERS.CSV
    const pHeader = "passenger_id,quiet_ride,radio_ok,smoking_ok,pets_ok,luggage_large,female_driver_pref\n";
    const pRows = passengers.map(p =>
      `P${p.id},${boolToYesNo(p.quiet_ride)},${boolToYesNo(p.radio_ok)},${boolToYesNo(p.smoking_ok)},${boolToYesNo(p.pets_ok)},${boolToYesNo(p.luggage_large)},${boolToYesNo(p.female_driver_pref)}`
    ).join("\n");
    const pPath = path.join(exportDir, "passengers.csv");
    fs.writeFileSync(pPath, pHeader + pRows);
    console.log(`✅ passengers.csv créé (${pPath})`);

    // DRIVERS.CSV
    const dHeader = "driver_id,talkative,radio_on,smoking_allowed,pets_allowed,car_big,driver_gender,rating,works_morning,works_afternoon,works_evening,works_night\n";
    const dRows = drivers.map(d =>
      `D${d.id},${boolToYesNo(d.talkative)},${boolToYesNo(d.radio_on)},${boolToYesNo(d.smoking_allowed)},${boolToYesNo(d.pets_allowed)},${boolToYesNo(d.car_big)},${d.sexe?.toLowerCase() === "f" ? "female" : "male"},${(d.note || 4.0).toFixed(1)},${boolToYesNo(d.works_morning)},${boolToYesNo(d.works_afternoon)},${boolToYesNo(d.works_evening)},${boolToYesNo(d.works_night)}`
    ).join("\n");
    const dPath = path.join(exportDir, "drivers.csv");
    fs.writeFileSync(dPath, dHeader + dRows);
    console.log(`✅ drivers.csv créé (${dPath})`);

    // INTERACTIONS.CSV
    const iHeader = "passenger_id,driver_id,weight,date_trajet\n";
    const iRows = interactions.map(i => 
      `${i.passenger_id},${i.driver_id},${i.weight},${i.date_trajet.toISOString()}`
    ).join("\n");
    const iPath = path.join(exportDir, "interactions.csv");
    fs.writeFileSync(iPath, iHeader + iRows);
    console.log(`✅ interactions.csv créé (${iPath})\n`);

    console.log("🎉 Export terminé avec succès !");
    console.log(`📂 Fichiers dans : ${exportDir}\n`);
    console.log("🚀 Prochaine étape : cd ../ml-service && python train_model.py\n");

    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error("❌ Erreur lors de l'export :", error);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// ✅ EXÉCUTION DIRECTE (CORRIGÉE)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lancer immédiatement
exportLightFM();

export { exportLightFM };