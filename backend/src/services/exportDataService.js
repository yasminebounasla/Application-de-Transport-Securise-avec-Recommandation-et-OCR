import { prisma } from "../config/prisma.js";
import fs from "fs";
import path from "path";

// Convert Boolean true/false en "yes"/"no"
const boolToYesNo = (b) => (b ? "yes" : "no");

// Random small noise [-1.5, 1.5]
const randomNoise = () => (Math.random() * 3 - 1.5);

async function exportLightFM() {
  const passengers = await prisma.passenger.findMany();
  const drivers = await prisma.driver.findMany();

  console.log("🚀 Génération des interactions avec weight...");

  const interactions = [];

  for (const p of passengers) {
    // Sample 10 drivers pour chaque passager
    const sampledDrivers = drivers.sort(() => 0.5 - Math.random()).slice(0, 10);

    for (const d of sampledDrivers) {
      let score = 0;

      if (boolToYesNo(p.quiet_ride) === "yes" && boolToYesNo(d.talkative) === "no") score += 3;
      if (boolToYesNo(p.radio_ok) === "no" && boolToYesNo(d.radio_on) === "yes") score -= 2;
      if (boolToYesNo(p.luggage_large) === "yes" && boolToYesNo(d.car_big) === "no") score -= 4;
      if (boolToYesNo(p.female_driver_pref) === "yes" && d.sexe?.toLowerCase() === "f") score += 3;

      score += randomNoise();

      interactions.push({
        passenger_id: `P${p.id}`,
        driver_id: `D${d.id}`,
        weight: score
      });
    }
  }

  // Normalisation MinMax 0-1
  const weights = interactions.map(i => i.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  interactions.forEach(i => {
    i.weight = ((i.weight - minW) / (maxW - minW)).toFixed(4);
  });

  // ---------- EXPORT CSV ----------
  const exportDir = path.join(process.cwd(), "../ml-service/lightfm_data");
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

  // Passengers CSV
  const pHeader = "passenger_id,quiet_ride,radio_ok,smoking_ok,pets_ok,luggage_large,female_driver_pref\n";
  const pRows = passengers.map(p =>
    `P${p.id},${boolToYesNo(p.quiet_ride)},${boolToYesNo(p.radio_ok)},${boolToYesNo(p.smoking_ok)},${boolToYesNo(p.pets_ok)},${boolToYesNo(p.luggage_large)},${boolToYesNo(p.female_driver_pref)}`
  ).join("\n");
  fs.writeFileSync(path.join(exportDir, "passengers.csv"), pHeader + pRows);

  // Drivers CSV
  const dHeader = "driver_id,talkative,radio_on,smoking_allowed,pets_allowed,car_big,driver_gender,rating,works_morning,works_afternoon,works_evening,works_night\n";
  const dRows = drivers.map(d =>
    `D${d.id},${boolToYesNo(d.talkative)},${boolToYesNo(d.radio_on)},${boolToYesNo(d.smoking_allowed)},${boolToYesNo(d.pets_allowed)},${boolToYesNo(d.car_big)},${d.sexe?.toLowerCase() === "f" ? "female" : "male"},${(d.note || (Math.random() * 1.5 + 3.5)).toFixed(1)},${boolToYesNo(d.works_morning)},${boolToYesNo(d.works_afternoon)},${boolToYesNo(d.works_evening)},${boolToYesNo(d.works_night)}`
  ).join("\n");
  fs.writeFileSync(path.join(exportDir, "drivers.csv"), dHeader + dRows);

  // Interactions CSV
  const iHeader = "passenger_id,driver_id,weight\n";
  const iRows = interactions.map(i => `${i.passenger_id},${i.driver_id},${i.weight}`).join("\n");
  fs.writeFileSync(path.join(exportDir, "interactions.csv"), iHeader + iRows);

  console.log("✅ CSV LightFM générés dans /lightfm_data !");
  process.exit();
}

export { exportLightFM };
