// exportLightFM.js
// User = Trajet, Item = Driver
// ✅ Ajouts : distance_km, score_distance, work_hour_match

import { prisma } from "../config/prisma.js";
import fs from "fs";
import path from "path";

const boolToYesNo = (b) => (b ? "yes" : "no");

// ── HAVERSINE ────────────────────────────────────────────────────────────────
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

// ── SCORE DISTANCE selon délai ───────────────────────────────────────────────
function scoreDistance(distanceKm, hoursUntilDeparture) {
  let referenceKm;
  if      (hoursUntilDeparture < 2)   referenceKm = 15;
  else if (hoursUntilDeparture < 24)  referenceKm = 40;
  else if (hoursUntilDeparture < 168) referenceKm = 80;
  else                                referenceKm = 200;

  return parseFloat((1 / (1 + distanceKm / referenceKm)).toFixed(4));
}

// ── HEURE DE TRAVAIL ─────────────────────────────────────────────────────────
function workHourMatch(driver, departureHour) {
  if (departureHour >= 5  && departureHour < 12  && driver.works_morning)   return 1;
  if (departureHour >= 12 && departureHour < 18  && driver.works_afternoon) return 1;
  if (departureHour >= 18 && departureHour < 22  && driver.works_evening)   return 1;
  if ((departureHour >= 22 || departureHour < 5) && driver.works_night)     return 1;
  return 0;
}

// ── EXPORT PRINCIPAL ─────────────────────────────────────────────────────────
async function exportLightFM() {
  console.log("🚀 Export LightFM — User=Trajet, Item=Driver\n");

  try {
    // ── 1. DRIVERS ───────────────────────────────────────────────────────────
    const drivers = await prisma.driver.findMany();

    // Map pour accès rapide driver par id
    const driverMap = {};
    drivers.forEach((d) => { driverMap[d.id] = d; });

    // ── 2. TRAJETS ───────────────────────────────────────────────────────────
    const trajets = await prisma.trajet.findMany({
      where: {
        status:     { in: ["COMPLETED", "CANCELLED_BY_PASSENGER"] },
        passagerId: { not: null },
        driverId:   { not: null },
      },
      include: {
        evaluation: true,
        passenger:  true,
      },
    });

    console.log(`✅ ${drivers.length} drivers, ${trajets.length} trajets récupérés`);

    // ── 3. INTERACTIONS ───────────────────────────────────────────────────────
    const interactions = [];

    for (const t of trajets) {
      const driver = driverMap[t.driverId];
      if (!driver) continue;

      // ── Weight ──────────────────────────────────────────────────────────
      let weight = 0.0;
      if (t.status === "CANCELLED_BY_PASSENGER") {
        weight = 0.1;
      } else if (t.status === "COMPLETED") {
        if (!t.evaluation) {
          weight = 0.5;
        } else {
          const r = t.evaluation.rating;
          if      (r >= 4.5) weight = 1.0;
          else if (r >= 4.0) weight = 0.8;
          else if (r >= 3.5) weight = 0.6;
          else if (r >= 3.0) weight = 0.4;
          else               weight = 0.2;
        }
      }

      // ── Distance driver → point de départ du trajet ──────────────────────
      let distanceKm   = null;
      let scoreDistVal = null;

      if (driver.latitude && driver.longitude && t.startLat && t.startLng) {
        distanceKm   = haversine(driver.latitude, driver.longitude, t.startLat, t.startLng);
        // Pour les trajets historiques on utilise 48h comme délai par défaut
        // (on n'a pas le vrai délai au moment de la réservation)
        const hoursUntilDep = 48;
        scoreDistVal = scoreDistance(distanceKm, hoursUntilDep);
      }

      // ── Heure de travail ─────────────────────────────────────────────────
      let workMatch = null;
      if (t.heureDepart) {
        const hour = parseInt(t.heureDepart.split(":")[0], 10);
        workMatch  = workHourMatch(driver, hour);
      }

      interactions.push({
        trajet_id:    `T${t.id}`,
        driver_id:    `D${t.driverId}`,
        passenger_id: `P${t.passagerId}`,
        weight:       weight.toFixed(2),

        // User features (préférences du trajet)
        quiet_ride:         t.quiet_ride,
        radio_ok:           t.radio_ok,
        smoking_ok:         t.smoking_ok,
        pets_ok:            t.pets_ok,
        luggage_large:      t.luggage_large,
        female_driver_pref: t.female_driver_pref,

        // ✅ Nouvelles features
        distance_km:        distanceKm  !== null ? distanceKm  : "N/A",
        score_distance:     scoreDistVal !== null ? scoreDistVal : "N/A",
        work_hour_match:    workMatch    !== null ? workMatch    : "N/A",

        date_trajet: t.updatedAt.toISOString(),
      });
    }

    // ── 4. DOSSIER D'EXPORT ───────────────────────────────────────────────────
    const exportDir = path.join(process.cwd(), "../ml-service/lightfm_data");
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

    // ── 5. TRAJETS.CSV (user features) ───────────────────────────────────────
    const tHeader =
      "trajet_id,passenger_id,quiet_ride,radio_ok,smoking_ok,pets_ok,luggage_large,female_driver_pref,distance_km,score_distance,work_hour_match\n";
    const tRows = interactions
      .map(
        (i) =>
          `${i.trajet_id},${i.passenger_id},${i.quiet_ride},${i.radio_ok},${i.smoking_ok},${i.pets_ok},${i.luggage_large},${i.female_driver_pref},${i.distance_km},${i.score_distance},${i.work_hour_match}`
      )
      .join("\n");
    fs.writeFileSync(path.join(exportDir, "trajets.csv"), tHeader + tRows);
    console.log("✅ trajets.csv créé (user features)");

    // ── 6. DRIVERS.CSV (item features) ───────────────────────────────────────
    const dHeader =
      "driver_id,talkative,radio_on,smoking_allowed,pets_allowed,car_big,driver_gender,avg_rating,works_morning,works_afternoon,works_evening,works_night,latitude,longitude\n";
    const dRows = drivers
      .map(
        (d) =>
          `D${d.id},${boolToYesNo(d.talkative)},${boolToYesNo(d.radio_on)},${boolToYesNo(d.smoking_allowed)},${boolToYesNo(d.pets_allowed)},${boolToYesNo(d.car_big)},${d.sexe?.toLowerCase() === "f" ? "female" : "male"},${(d.avgRating || 4.0).toFixed(1)},${boolToYesNo(d.works_morning)},${boolToYesNo(d.works_afternoon)},${boolToYesNo(d.works_evening)},${boolToYesNo(d.works_night)},${d.latitude ?? "N/A"},${d.longitude ?? "N/A"}`
      )
      .join("\n");
    fs.writeFileSync(path.join(exportDir, "drivers.csv"), dHeader + dRows);
    console.log("✅ drivers.csv créé (item features)");

    // ── 7. INTERACTIONS.CSV ───────────────────────────────────────────────────
    const iHeader = "trajet_id,driver_id,weight,date_trajet\n";
    const iRows   = interactions
      .map((i) => `${i.trajet_id},${i.driver_id},${i.weight},${i.date_trajet}`)
      .join("\n");
    fs.writeFileSync(path.join(exportDir, "interactions.csv"), iHeader + iRows);
    console.log("✅ interactions.csv créé");

    // ── 8. RÉSUMÉ ─────────────────────────────────────────────────────────────
    const withDist    = interactions.filter((i) => i.distance_km !== "N/A").length;
    const withWork    = interactions.filter((i) => i.work_hour_match !== "N/A").length;
    const highWeight  = interactions.filter((i) => parseFloat(i.weight) > 0.5).length;

    console.log(`\n📊 Résumé :`);
    console.log(`   Drivers                    : ${drivers.length}`);
    console.log(`   Interactions totales        : ${interactions.length}`);
    console.log(`   Avec distance calculée      : ${withDist}`);
    console.log(`   Avec work_hour_match        : ${withWork}`);
    console.log(`   Interactions weight > 0.5   : ${highWeight}`);
    console.log(`\n✅ Export terminé → ${exportDir}`);

    await prisma.$disconnect();

  } catch (error) {
    console.error("❌ Erreur lors de l'export :", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

export { exportLightFM };
exportLightFM();