// exportLightFM.js
// ✅ CORRIGÉ :
//   - score_distance unifié : exp(-km / ref) — même formule que recommender.py
//   - hoursUntilDeparture calculé depuis la vraie dateDepart du trajet (plus de 48h hardcodé)
//   - User = Passenger (pas Trajet)

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

// ✅ UNIFIÉ : même formule que recommender.py — exp(-km / ref)
// hoursUntilDeparture calculé depuis la vraie date du trajet
function scoreDistance(distanceKm, hoursUntilDeparture) {
  let referenceKm;
  if      (hoursUntilDeparture < 2)   referenceKm = 15;
  else if (hoursUntilDeparture < 24)  referenceKm = 40;
  else if (hoursUntilDeparture < 168) referenceKm = 80;
  else                                referenceKm = 200;
  return parseFloat(Math.exp(-distanceKm / referenceKm).toFixed(4));
}

// ✅ NOUVEAU : calcul réel de l'urgence depuis la date du trajet
function computeHoursUntilDeparture(dateDepart) {
  if (!dateDepart) return 168; // défaut : 1 semaine (trajet non urgent)
  const now         = Date.now();
  const depTime     = new Date(dateDepart).getTime();
  const diffHours   = (depTime - now) / (1000 * 60 * 60);
  // Les trajets du seed sont dans le passé → diffHours négatif
  // On retourne la valeur absolue pour avoir une "urgence relative" cohérente
  return Math.abs(diffHours);
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

    const interactions = [];
    const trajetRows   = [];

    for (const t of trajets) {
      const driver = driverMap[t.driverId];
      if (!driver) continue;

      // ── Poids interaction ─────────────────────────────────────────────────
      let weight = 0.0;
      if (t.status === "CANCELLED_BY_PASSENGER") {
        weight = 0.1;
      } else if (t.status === "COMPLETED") {
        weight = t.evaluation
          ? parseFloat(((t.evaluation.rating - 1.0) / 4.0).toFixed(4))
          : 0.5;
      }

      // ── Distance & score_distance ─────────────────────────────────────────
      // ✅ hoursUntilDeparture calculé depuis la vraie date du trajet
      let distanceKm        = null;
      let scoreDistVal      = null;
      const hoursUntilDep   = computeHoursUntilDeparture(t.dateDepart);

      if (driver.latitude && driver.longitude && t.startLat && t.startLng) {
        distanceKm   = haversine(driver.latitude, driver.longitude, t.startLat, t.startLng);
        // ✅ Même formule exp(-km/ref) que recommender.py
        scoreDistVal = scoreDistance(distanceKm, hoursUntilDep);
      }

      // ── Work hour match ───────────────────────────────────────────────────
      let workMatch = null;
      if (t.heureDepart) {
        const hour = parseInt(t.heureDepart.split(":")[0], 10);
        workMatch  = workHourMatch(driver, hour);
      }

      // ── Distance bucket ───────────────────────────────────────────────────
      const distBucket =
        distanceKm === null    ? "dist:medium" :
        distanceKm < 10        ? "dist:very_close" :
        distanceKm < 30        ? "dist:close" :
        distanceKm < 80        ? "dist:medium" :
        distanceKm < 200       ? "dist:far"    : "dist:very_far";

      // ── Interactions (passenger_id comme user) ────────────────────────────
      interactions.push({
        passenger_id: `P${t.passagerId}`,
        driver_id:    `D${t.driverId}`,
        weight:       weight.toFixed(4),
        date_trajet:  t.updatedAt.toISOString(),
      });

      // ── Trajet rows (user_features) ───────────────────────────────────────
      trajetRows.push({
        passenger_id:       `P${t.passagerId}`,
        trajet_id:          `T${t.id}`,
        quiet_ride:         t.quiet_ride         ?? "no",
        radio_ok:           t.radio_ok           ?? "no",
        smoking_ok:         t.smoking_ok         ?? "no",
        pets_ok:            t.pets_ok            ?? "no",
        luggage_large:      t.luggage_large      ?? "no",
        female_driver_pref: t.female_driver_pref ?? "no",
        distance_km:        distanceKm   !== null ? distanceKm   : "N/A",
        score_distance:     scoreDistVal !== null ? scoreDistVal : "N/A",
        work_hour_match:    workMatch    !== null ? workMatch    : "N/A",
        distance_bucket:    distBucket,
      });
    }

    // ── Export fichiers CSV ───────────────────────────────────────────────────
    const exportDir = path.join(process.cwd(), "../ml-service/lightfm_data");
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

    // trajets.csv (user_features)
    const tHeader = "passenger_id,trajet_id,quiet_ride,radio_ok,smoking_ok,pets_ok,luggage_large,female_driver_pref,distance_km,score_distance,work_hour_match,distance_bucket\n";
    const tRows   = trajetRows
      .map((r) =>
        `${r.passenger_id},${r.trajet_id},${r.quiet_ride},${r.radio_ok},${r.smoking_ok},${r.pets_ok},${r.luggage_large},${r.female_driver_pref},${r.distance_km},${r.score_distance},${r.work_hour_match},${r.distance_bucket}`
      )
      .join("\n");
    fs.writeFileSync(path.join(exportDir, "trajets.csv"), tHeader + tRows);
    console.log("✅ trajets.csv créé");

    // drivers.csv (item_features)
    const dHeader =
      "driver_id,talkative,radio_on,smoking_allowed,pets_allowed,car_big,driver_gender,avg_rating,works_morning,works_afternoon,works_evening,works_night,latitude,longitude\n";
    const dRows = drivers
      .map(
        (d) =>
          `D${d.id},${boolToYesNo(d.talkative)},${boolToYesNo(d.radio_on)},${boolToYesNo(d.smoking_allowed)},${boolToYesNo(d.pets_allowed)},${boolToYesNo(d.car_big)},${d.sexe?.toLowerCase() === "f" ? "female" : "male"},${(d.avgRating || 4.0).toFixed(1)},${boolToYesNo(d.works_morning)},${boolToYesNo(d.works_afternoon)},${boolToYesNo(d.works_evening)},${boolToYesNo(d.works_night)},${d.latitude ?? "N/A"},${d.longitude ?? "N/A"}`
      )
      .join("\n");
    fs.writeFileSync(path.join(exportDir, "drivers.csv"), dHeader + dRows);
    console.log("✅ drivers.csv créé");

    // interactions.csv
    const iHeader = "passenger_id,driver_id,weight,date_trajet\n";
    const iRows   = interactions
      .map((i) => `${i.passenger_id},${i.driver_id},${i.weight},${i.date_trajet}`)
      .join("\n");
    fs.writeFileSync(path.join(exportDir, "interactions.csv"), iHeader + iRows);
    console.log("✅ interactions.csv créé");

    // ── Résumé ────────────────────────────────────────────────────────────────
    const w               = interactions.map((i) => parseFloat(i.weight));
    const uniquePassengers = new Set(interactions.map((i) => i.passenger_id)).size;

    console.log(`\n📊 Résumé export :`);
    console.log(`   Drivers              : ${drivers.length}`);
    console.log(`   Passagers uniques    : ${uniquePassengers}  ← chacun a un embedding LightFM`);
    console.log(`   Interactions totales : ${interactions.length}`);
    console.log(
      `   Moy. interactions/passager : ${(interactions.length / uniquePassengers).toFixed(1)}`
    );
    console.log(`   Weight ≥ 0.75 (top)  : ${w.filter((x) => x >= 0.75).length}`);
    console.log(`   Weight 0.4–0.75      : ${w.filter((x) => x >= 0.4 && x < 0.75).length}`);
    console.log(`   Weight < 0.4 (neg)   : ${w.filter((x) => x < 0.4).length}`);
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