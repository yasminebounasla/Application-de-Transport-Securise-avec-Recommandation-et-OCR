// exportLightFM.js
// Nouvelle logique : User = Trajet, Item = Driver
import { prisma } from "../config/prisma.js";
import fs from "fs";
import path from "path";

const boolToYesNo = (b) => (b ? "yes" : "no");

async function exportLightFM() {
  console.log("🚀 Export LightFM — User=Trajet, Item=Driver\n");

  try {
    // ── 1. DRIVERS (items) ──────────────────────────────────────────────────
    const drivers = await prisma.driver.findMany();

    // ── 2. TRAJETS COMPLÉTÉS avec évaluation (interactions) ─────────────────
    const trajets = await prisma.trajet.findMany({
      where: {
        status: { in: ["COMPLETED", "CANCELLED_BY_PASSENGER"] },
        passagerId: { not: null },
      },
      include: {
        evaluation: true,
        passenger: true,
      },
    });

    console.log(`✅ ${drivers.length} drivers, ${trajets.length} trajets récupérés`);

    // ── 3. INTERACTIONS ──────────────────────────────────────────────────────
    // User = Trajet (T{id}), Item = Driver (D{id})
    // Le poids est basé sur la note de l'évaluation
    const interactions = trajets.map((t) => {
      let weight = 0.0;

      if (t.status === "CANCELLED_BY_PASSENGER") {
        weight = 0.1; // Signal négatif léger
      } else if (t.status === "COMPLETED") {
        if (!t.evaluation) {
          weight = 0.5; // Complété sans évaluation = neutre
        } else {
          const r = t.evaluation.rating;
          if (r >= 4.5) weight = 1.0;
          else if (r >= 4.0) weight = 0.8;
          else if (r >= 3.5) weight = 0.6;
          else if (r >= 3.0) weight = 0.4;
          else weight = 0.2;
        }
      }

      return {
        trajet_id: `T${t.id}`,         // USER = Trajet
        driver_id: `D${t.driverId}`,   // ITEM = Driver
        passenger_id: `P${t.passagerId}`, // Metadata pour référence
        weight: weight.toFixed(2),
        // Préférences du trajet (user features pour LightFM)
        quiet_ride: t.quiet_ride,
        radio_ok: t.radio_ok,
        smoking_ok: t.smoking_ok,
        pets_ok: t.pets_ok,
        luggage_large: t.luggage_large,
        female_driver_pref: t.female_driver_pref,
        date_trajet: t.updatedAt.toISOString(),
      };
    });

    // ── 4. CRÉATION DU DOSSIER D'EXPORT ─────────────────────────────────────
    const exportDir = path.join(process.cwd(), "../ml-service/lightfm_data");
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

    // ── 5. TRAJETS.CSV (user features) ──────────────────────────────────────
    // Ce fichier contient les features de chaque "user" = trajet
    const tHeader =
      "trajet_id,passenger_id,quiet_ride,radio_ok,smoking_ok,pets_ok,luggage_large,female_driver_pref\n";
    const tRows = interactions
      .map(
        (i) =>
          `${i.trajet_id},${i.passenger_id},${i.quiet_ride},${i.radio_ok},${i.smoking_ok},${i.pets_ok},${i.luggage_large},${i.female_driver_pref}`
      )
      .join("\n");
    fs.writeFileSync(path.join(exportDir, "trajets.csv"), tHeader + tRows);
    console.log("✅ trajets.csv créé (user features)");

    // ── 6. DRIVERS.CSV (item features) ──────────────────────────────────────
    const dHeader =
      "driver_id,talkative,radio_on,smoking_allowed,pets_allowed,car_big,driver_gender,avg_rating,works_morning,works_afternoon,works_evening,works_night\n";
    const dRows = drivers
      .map(
        (d) =>
          `D${d.id},${boolToYesNo(d.talkative)},${boolToYesNo(d.radio_on)},${boolToYesNo(d.smoking_allowed)},${boolToYesNo(d.pets_allowed)},${boolToYesNo(d.car_big)},${d.sexe?.toLowerCase() === "f" ? "female" : "male"},${(d.avgRating || 4.0).toFixed(1)},${boolToYesNo(d.works_morning)},${boolToYesNo(d.works_afternoon)},${boolToYesNo(d.works_evening)},${boolToYesNo(d.works_night)}`
      )
      .join("\n");
    fs.writeFileSync(path.join(exportDir, "drivers.csv"), dHeader + dRows);
    console.log("✅ drivers.csv créé (item features)");

    // ── 7. INTERACTIONS.CSV ──────────────────────────────────────────────────
    const iHeader = "trajet_id,driver_id,weight,date_trajet\n";
    const iRows = interactions
      .map((i) => `${i.trajet_id},${i.driver_id},${i.weight},${i.date_trajet}`)
      .join("\n");
    fs.writeFileSync(path.join(exportDir, "interactions.csv"), iHeader + iRows);
    console.log("✅ interactions.csv créé");

    console.log(`\n📊 Résumé:`);
    console.log(`   - ${drivers.length} drivers (items)`);
    console.log(`   - ${interactions.length} interactions (trajets → drivers)`);
    console.log(`   - Interactions avec weight > 0.5 : ${interactions.filter((i) => parseFloat(i.weight) > 0.5).length}`);

    await prisma.$disconnect();
    
  } catch (error) {
    console.error("❌ Erreur lors de l'export :", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

export { exportLightFM };
exportLightFM();