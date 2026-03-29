// exportDataService.js — CORRIGÉ
//
// ✅ Bug 3 FIX — Signal prefMatch renforcé dans le weight :
//
//   ANCIENNE FORMULE :
//     weight = noteNorm × (0.70 + 0.30 × prefMatch)
//     → si noteNorm=1.0 et prefMatch=0.0 : weight = 0.70
//     → si noteNorm=1.0 et prefMatch=1.0 : weight = 1.00
//     → DELTA = 0.30 seulement → LightFM voit peu de différence entre
//       "bonne note + bon match" et "bonne note + mauvais match"
//
//   NOUVELLE FORMULE :
//     weight = noteNorm × (0.50 + 0.50 × prefMatch)
//     → si noteNorm=1.0 et prefMatch=0.0 : weight = 0.50
//     → si noteNorm=1.0 et prefMatch=1.0 : weight = 1.00
//     → DELTA = 0.50 → signal 67% plus fort pour le content-based
//     → LightFM apprend "bonne note AVEC bon match prefs" = vraiment positif
//     → LightFM apprend "bonne note SANS match prefs"  = signal moyen
//
//   TABLE DE CONVERSION CORRIGÉE :
//     Annulation                    → 0.05  (signal négatif fort — inchangé)
//     Complété sans évaluation      → 0.30  (signal neutre — inchangé)
//     Note 1 + mismatch (pm=0)      → 0.00 × 0.50 = 0.00
//     Note 2 + mismatch (pm=0)      → 0.25 × 0.50 = 0.12
//     Note 3 + neutre   (pm=0.5)    → 0.50 × 0.75 = 0.37
//     Note 4 + bon match (pm=1.0)   → 0.75 × 1.00 = 0.75
//     Note 5 + bon match (pm=1.0)   → 1.00 × 1.00 = 1.00
//     Note 5 + mismatch (pm=0.0)    → 1.00 × 0.50 = 0.50  ← ici le changement clé
//     → WARP voit un contraste max-min de ~1.00 au lieu de ~0.70

import { prisma } from "../config/prisma.js";
import fs from "fs";
import path from "path";

const boolToYesNo = (b) => (b ? "yes" : "no");

// ── HAVERSINE ─────────────────────────────────────────────────────────────────
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
  return parseFloat(Math.exp(-distanceKm / referenceKm).toFixed(4));
}

function computeHoursUntilDeparture(dateDepart) {
  if (!dateDepart) return 168;
  const diffHours = (new Date(dateDepart).getTime() - Date.now()) / (1000 * 60 * 60);
  return Math.abs(diffHours);
}

function workHourMatch(driver, departureHour) {
  if (departureHour >= 5  && departureHour < 12  && driver.works_morning)   return 1;
  if (departureHour >= 12 && departureHour < 18  && driver.works_afternoon) return 1;
  if (departureHour >= 18 && departureHour < 22  && driver.works_evening)   return 1;
  if ((departureHour >= 22 || departureHour < 5) && driver.works_night)     return 1;
  return 0;
}

// ── PREF MATCH — même logique que recommender.py ─────────────────────────────
function prefMatch(trajet, driver) {
  const b = (val) => {
    if (val === null || val === undefined) return "no";
    if (typeof val === "boolean") return val ? "yes" : "no";
    return String(val).trim().toLowerCase();
  };

  const checks = [
    ["female_driver_pref", b(driver.sexe),             "f",   "m",   2],
    ["smoking_ok",         b(driver.smoking_allowed),   "yes", "no",  2],
    ["luggage_large",      b(driver.car_big),           "yes", "no",  2],
    ["pets_ok",            b(driver.pets_allowed),      "yes", "no",  2],
    ["quiet_ride",         b(driver.talkative),         "no",  "yes", 1],
    ["radio_ok",           b(driver.radio_on),          "yes", "no",  1],
  ];

  let score = 0, maxPoints = 0;
  for (const [prefKey, driverVal, matchIfYes, matchIfNo, points] of checks) {
    const pref = b(trajet[prefKey]);
    if (pref !== "yes" && pref !== "no") continue;
    maxPoints += points;
    const target = pref === "yes" ? matchIfYes : matchIfNo;
    score += driverVal === target ? points : -points;
  }

  if (maxPoints === 0) return 0.5;
  return (score + maxPoints) / (2 * maxPoints);
}

// ── ✅ Bug 3 FIX — WEIGHT ENRICHI avec signal prefMatch renforcé ──────────────
function computeWeight(trajet, driver) {
  if (trajet.status === "CANCELLED_BY_PASSENGER") {
    return 0.05;
  }
  if (!trajet.evaluation) {
    return 0.30;
  }

  const noteNorm = (trajet.evaluation.rating - 1.0) / 4.0; // [0.0, 1.0]
  const pm       = prefMatch(trajet, driver);               // [0.0, 1.0]

  // ✅ ANCIENNE : weight = noteNorm × (0.70 + 0.30 × prefMatch)  → delta max = 0.30
  // ✅ NOUVELLE : weight = noteNorm × (0.50 + 0.50 × prefMatch)  → delta max = 0.50
  const w = noteNorm * (0.50 + 0.50 * pm);
  return parseFloat(Math.max(0.01, Math.min(1.0, w)).toFixed(4));
}

// ── EXPORT PRINCIPAL ──────────────────────────────────────────────────────────
async function exportLightFM() {
  console.log("🚀 Export LightFM CORRIGÉ — formule weight renforcée\n");

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

      const weight = computeWeight(t, driver);

      let distanceKm   = null;
      let scoreDistVal = null;
      const hoursUntilDep = computeHoursUntilDeparture(t.dateDepart);

      if (driver.latitude && driver.longitude && t.startLat && t.startLng) {
        distanceKm   = haversine(driver.latitude, driver.longitude, t.startLat, t.startLng);
        scoreDistVal = scoreDistance(distanceKm, hoursUntilDep);
      }

      let workMatch = null;
      if (t.heureDepart) {
        const hour = parseInt(t.heureDepart.split(":")[0], 10);
        workMatch  = workHourMatch(driver, hour);
      }

      const distBucket =
        distanceKm === null ? "dist:medium" :
        distanceKm < 10     ? "dist:very_close" :
        distanceKm < 30     ? "dist:close" :
        distanceKm < 80     ? "dist:medium" :
        distanceKm < 200    ? "dist:far" : "dist:very_far";

      interactions.push({
        passenger_id: `P${t.passagerId}`,
        driver_id:    `D${t.driverId}`,
        trajet_id:    `T${t.id}`,
        weight:       weight.toFixed(4),
        date_trajet:  t.updatedAt.toISOString(),
      });

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

    // ── Écriture CSV ──────────────────────────────────────────────────────────
    const exportDir = path.join(process.cwd(), "../ml-service/lightfm_data");
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

    const tHeader = "passenger_id,trajet_id,quiet_ride,radio_ok,smoking_ok,pets_ok,luggage_large,female_driver_pref,distance_km,score_distance,work_hour_match,distance_bucket\n";
    const tRows   = trajetRows
      .map((r) => `${r.passenger_id},${r.trajet_id},${r.quiet_ride},${r.radio_ok},${r.smoking_ok},${r.pets_ok},${r.luggage_large},${r.female_driver_pref},${r.distance_km},${r.score_distance},${r.work_hour_match},${r.distance_bucket}`)
      .join("\n");
    fs.writeFileSync(path.join(exportDir, "trajets.csv"), tHeader + tRows);
    console.log("✅ trajets.csv créé");

    const dHeader = "driver_id,talkative,radio_on,smoking_allowed,pets_allowed,car_big,driver_gender,avg_rating,works_morning,works_afternoon,works_evening,works_night,latitude,longitude\n";
    const dRows   = drivers
      .map((d) => `D${d.id},${boolToYesNo(d.talkative)},${boolToYesNo(d.radio_on)},${boolToYesNo(d.smoking_allowed)},${boolToYesNo(d.pets_allowed)},${boolToYesNo(d.car_big)},${d.sexe?.toLowerCase() === "f" ? "female" : "male"},${(d.avgRating || 4.0).toFixed(1)},${boolToYesNo(d.works_morning)},${boolToYesNo(d.works_afternoon)},${boolToYesNo(d.works_evening)},${boolToYesNo(d.works_night)},${d.latitude ?? "N/A"},${d.longitude ?? "N/A"}`)
      .join("\n");
    fs.writeFileSync(path.join(exportDir, "drivers.csv"), dHeader + dRows);
    console.log("✅ drivers.csv créé");

    const iHeader = "passenger_id,driver_id,trajet_id,weight,date_trajet\n";
    const iRows   = interactions
      .map((i) => `${i.passenger_id},${i.driver_id},${i.trajet_id},${i.weight},${i.date_trajet}`)
      .join("\n");
    fs.writeFileSync(path.join(exportDir, "interactions.csv"), iHeader + iRows);
    console.log("✅ interactions.csv créé");

    // ── Résumé ────────────────────────────────────────────────────────────────
    const wArr             = interactions.map((i) => parseFloat(i.weight));
    const uniquePassengers = new Set(interactions.map((i) => i.passenger_id)).size;
    const wMax             = Math.max(...wArr);
    const wMin             = Math.min(...wArr);
    const contraste        = wMax - wMin;

    console.log(`\n📊 Résumé export :`);
    console.log(`   Drivers              : ${drivers.length}`);
    console.log(`   Passagers uniques    : ${uniquePassengers}`);
    console.log(`   Interactions totales : ${interactions.length}`);
    console.log(`   Moy/passager         : ${(interactions.length / uniquePassengers).toFixed(1)}`);
    console.log(`\n📊 Distribution weights CORRIGÉS (formule 0.50 + 0.50×pm) :`);
    console.log(`   ≥ 0.75 (très positif)  : ${wArr.filter((x) => x >= 0.75).length}`);
    console.log(`   0.40–0.75 (positif)    : ${wArr.filter((x) => x >= 0.40 && x < 0.75).length}`);
    console.log(`   0.10–0.40 (neutre/neg) : ${wArr.filter((x) => x >= 0.10 && x < 0.40).length}`);
    console.log(`   < 0.10 (très négatif)  : ${wArr.filter((x) => x < 0.10).length}`);
    console.log(`   Contraste max-min      : ${contraste.toFixed(3)}`);

    if (contraste < 0.50) {
      console.warn("\n⚠️  Contraste < 0.50 — signal content-based encore insuffisant");
      console.warn("   → Vérifie que tes passagers ont des prefs variées et des notes variées");
    } else {
      console.log("\n✅ Contraste ≥ 0.50 — LightFM peut apprendre le content-based correctement");
    }

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