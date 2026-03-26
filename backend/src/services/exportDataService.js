// exportLightFM.js
// ✅ CORRIGÉ — User = Passenger (pas Trajet)
// Chaque passager accumule un historique → LightFM apprend ses goûts réels
// Les préférences variables (quiet_ride, heure, etc.) passent en user_features au predict()

import { prisma } from "../config/prisma.js";
import fs from "fs";
import path from "path";

const boolToYesNo = (b) => (b ? "yes" : "no");

function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

function scoreDistance(distanceKm, hoursUntilDeparture) {
  let referenceKm;
  if      (hoursUntilDeparture < 2)   referenceKm = 15;
  else if (hoursUntilDeparture < 24)  referenceKm = 40;
  else if (hoursUntilDeparture < 168) referenceKm = 80;
  else                                referenceKm = 200;
  return parseFloat((1 / (1 + distanceKm / referenceKm)).toFixed(4));
}

function workHourMatch(driver, departureHour) {
  if (departureHour >= 5  && departureHour < 12  && driver.works_morning)   return 1;
  if (departureHour >= 12 && departureHour < 18  && driver.works_afternoon) return 1;
  if (departureHour >= 18 && departureHour < 22  && driver.works_evening)   return 1;
  if ((departureHour >= 22 || departureHour < 5) && driver.works_night)     return 1;
  return 0;
}

async function exportLightFM() {
  console.log("🚀 Export LightFM — User=Passenger, Item=Driver\n");

  try {
    const drivers = await prisma.driver.findMany();
    const driverMap = {};
    drivers.forEach((d) => { driverMap[d.id] = d; });

    const trajets = await prisma.trajet.findMany({
      where: {
        status:     { in: ["COMPLETED", "CANCELLED_BY_PASSENGER"] },
        passagerId: { not: null },
        driverId:   { not: null },
      },
      include: { evaluation: true, passenger: true },
    });

    console.log(`✅ ${drivers.length} drivers, ${trajets.length} trajets récupérés`);

    // ── INTERACTIONS ──────────────────────────────────────────────────────────
    // ✅ CHANGEMENT CLÉ : on groupe par passenger_id, pas trajet_id
    // Résultat : LightFM voit plusieurs interactions PAR passager → apprend son profil
    const interactions = [];

    // ── TRAJETS (user_features) ───────────────────────────────────────────────
    // On garde une ligne par trajet pour les user_features
    // LightFM agrège automatiquement les features multi-lignes d'un même passager
    const trajetRows = [];

    for (const t of trajets) {
      const driver = driverMap[t.driverId];
      if (!driver) continue;

      let weight = 0.0;
      if (t.status === "CANCELLED_BY_PASSENGER") {
        weight = 0.1;
      } else if (t.status === "COMPLETED") {
        if (!t.evaluation) {
          weight = 0.5;
        } else {
          const r = t.evaluation.rating;
          weight = parseFloat(((r - 1.0) / 4.0).toFixed(4));
        }
      }

      let distanceKm   = null;
      let scoreDistVal = null;
      if (driver.latitude && driver.longitude && t.startLat && t.startLng) {
        distanceKm   = haversine(driver.latitude, driver.longitude, t.startLat, t.startLng);
        scoreDistVal = scoreDistance(distanceKm, 48);
      }

      let workMatch = null;
      if (t.heureDepart) {
        const hour = parseInt(t.heureDepart.split(":")[0], 10);
        workMatch  = workHourMatch(driver, hour);
      }

      // ✅ CHANGEMENT : passenger_id comme identifiant user (plus trajet_id)
      interactions.push({
        passenger_id:       `P${t.passagerId}`,   // ← ici le vrai changement
        driver_id:          `D${t.driverId}`,
        weight:             weight.toFixed(4),
        date_trajet:        t.updatedAt.toISOString(),
      });

      // Garder les features du trajet séparément (pour user_features dans retrain)
      trajetRows.push({
        passenger_id:       `P${t.passagerId}`,
        trajet_id:          `T${t.id}`,           // gardé pour référence seulement
        quiet_ride:         t.quiet_ride         ?? "no",
        radio_ok:           t.radio_ok           ?? "no",
        smoking_ok:         t.smoking_ok         ?? "no",
        pets_ok:            t.pets_ok            ?? "no",
        luggage_large:      t.luggage_large      ?? "no",
        female_driver_pref: t.female_driver_pref ?? "no",
        distance_km:        distanceKm   !== null ? distanceKm   : "N/A",
        score_distance:     scoreDistVal !== null ? scoreDistVal : "N/A",
        work_hour_match:    workMatch    !== null ? workMatch    : "N/A",
      });
    }

    // ── EXPORT ───────────────────────────────────────────────────────────────
    const exportDir = path.join(process.cwd(), "../ml-service/lightfm_data");
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

    // trajets.csv — user_features (une ligne par trajet, groupé par passenger_id dans retrain)
    const tHeader = "passenger_id,trajet_id,quiet_ride,radio_ok,smoking_ok,pets_ok,luggage_large,female_driver_pref,distance_km,score_distance,work_hour_match\n";
    const tRows   = trajetRows
      .map((r) => `${r.passenger_id},${r.trajet_id},${r.quiet_ride},${r.radio_ok},${r.smoking_ok},${r.pets_ok},${r.luggage_large},${r.female_driver_pref},${r.distance_km},${r.score_distance},${r.work_hour_match}`)
      .join("\n");
    fs.writeFileSync(path.join(exportDir, "trajets.csv"), tHeader + tRows);
    console.log("✅ trajets.csv créé");

    // drivers.csv — item features (inchangé)
    const dHeader = "driver_id,talkative,radio_on,smoking_allowed,pets_allowed,car_big,driver_gender,avg_rating,works_morning,works_afternoon,works_evening,works_night,latitude,longitude\n";
    const dRows   = drivers
      .map((d) => `D${d.id},${boolToYesNo(d.talkative)},${boolToYesNo(d.radio_on)},${boolToYesNo(d.smoking_allowed)},${boolToYesNo(d.pets_allowed)},${boolToYesNo(d.car_big)},${d.sexe?.toLowerCase() === "f" ? "female" : "male"},${(d.avgRating || 4.0).toFixed(1)},${boolToYesNo(d.works_morning)},${boolToYesNo(d.works_afternoon)},${boolToYesNo(d.works_evening)},${boolToYesNo(d.works_night)},${d.latitude ?? "N/A"},${d.longitude ?? "N/A"}`)
      .join("\n");
    fs.writeFileSync(path.join(exportDir, "drivers.csv"), dHeader + dRows);
    console.log("✅ drivers.csv créé");

    // interactions.csv — ✅ passenger_id comme user
    const iHeader = "passenger_id,driver_id,weight,date_trajet\n";
    const iRows   = interactions
      .map((i) => `${i.passenger_id},${i.driver_id},${i.weight},${i.date_trajet}`)
      .join("\n");
    fs.writeFileSync(path.join(exportDir, "interactions.csv"), iHeader + iRows);
    console.log("✅ interactions.csv créé");

    // Résumé
    const w     = interactions.map((i) => parseFloat(i.weight));
    const highW = w.filter((x) => x >= 0.75).length;
    const midW  = w.filter((x) => x >= 0.4 && x < 0.75).length;
    const lowW  = w.filter((x) => x < 0.4).length;

    // Nombre de passagers uniques
    const uniquePassengers = new Set(interactions.map(i => i.passenger_id)).size;

    console.log(`\n📊 Résumé export :`);
    console.log(`   Drivers              : ${drivers.length}`);
    console.log(`   Passagers uniques    : ${uniquePassengers}  ← chacun a un embedding LightFM`);
    console.log(`   Interactions totales : ${interactions.length}`);
    console.log(`   Moy. interactions/passager : ${(interactions.length / uniquePassengers).toFixed(1)}`);
    console.log(`   Weight ≥ 0.75 (top)  : ${highW}`);
    console.log(`   Weight 0.4–0.75      : ${midW}`);
    console.log(`   Weight < 0.4 (neg)   : ${lowW}`);
    console.log(`\n✅ Export terminé → ${exportDir}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ Erreur:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

export { exportLightFM };
exportLightFM();