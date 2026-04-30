// exportDataService.js — EXCLUSION STRICTE DES PRÉFÉRENCES
//
// CHANGEMENTS PAR RAPPORT À LA VERSION PRÉCÉDENTE :
//
//   ✅ prefMatch — logique exclusion stricte :
//        oui → driver DOIT avoir la feature
//        non → driver NE DOIT PAS avoir la feature
//        Toute violation = mismatch TOTAL (score = 0) pour cette pref.
//        C'était du scoring souple avant — maintenant c'est binaire par pref.
//
//   ✅ computeWeight — pénalité dure sur les mismatches stricts :
//        Un mismatch strict (driver présent alors que pref=non, ou absent alors
//        que pref=oui) tire le weight à 0.0 immédiatement.
//        LightFM n'apprend JAMAIS "ce passager est content avec ce driver"
//        si une pref stricte est violée.
//
//   ✅ prefMatch retourne maintenant {score, hasStrictViolation} pour
//        que computeWeight puisse appliquer la pénalité dure.

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
  if (departureHour >= 5  && departureHour < 12  && driver.workingHours?.works_morning)   return 1;
  if (departureHour >= 12 && departureHour < 18  && driver.workingHours?.works_afternoon) return 1;
  if (departureHour >= 18 && departureHour < 22  && driver.workingHours?.works_evening)   return 1;
  if ((departureHour >= 22 || departureHour < 5) && driver.workingHours?.works_night)     return 1;
  return 0;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function toBool(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === "boolean") return val;
  const s = String(val).trim().toLowerCase();
  return s === "yes" || s === "true" || s === "1" || s === "oui";
}

function toPref(val) {
  // Retourne true (oui), false (non), ou null (absent)
  if (val === null || val === undefined) return null;
  const s = String(val).trim().toLowerCase();
  if (s === "yes" || s === "oui" || s === "true" || s === "1") return true;
  if (s === "no"  || s === "non" || s === "false" || s === "0") return false;
  return null;
}

// ── PREF MATCH — EXCLUSION STRICTE ───────────────────────────────────────────
//
// Règles (même table que recommender.py) :
//   female_driver_pref | driver.sexe == "f"        | oui→F requis,  non→M requis
//   smoking_ok         | driver.smoking_allowed    | oui→fumeur,    non→non-fumeur
//   luggage_large      | driver.car_big            | oui→grand,     non→petit
//   pets_ok            | driver.pets_allowed       | oui→animaux,   non→sans animaux
//   quiet_ride         | NOT driver.talkative      | oui→calme,     non→bavard
//   radio_ok           | driver.radio_on           | oui→radio,     non→silence
//
// Retourne { score: [0,1], hasStrictViolation: bool }
//   score = fraction de prefs actives satisfaites (toutes binaires)
//   hasStrictViolation = true si AU MOINS UNE pref active est violée

function prefMatch(trajet, driver) {
  const RULES = [
    ["femal_driver_pref", () => String(driver.sexe || "").trim().toLowerCase() === "f"],
    ["smoking", () => toBool(driver.preferences?.smoking)],
    ["luggage_large", () => toBool(driver.preferences?.luggage_large)],
    ["pets", () => toBool(driver.preferences?.pets)],
    ["talkative", () => toBool(driver.preferences?.talkative)],
    ["radio", () => toBool(driver.preferences?.radio)],
  ];

  let score = 0;
  let total = 0;
  let strongViolation = false;

  for (const [key, getDriverVal] of RULES) {
    const prefVal = toPref(trajet.preferences?.[key]);
    if (prefVal === null) continue;

    total++;

    const driverHas = getDriverVal();

    let match = false;

    if (key === "talkative") {
      match = prefVal ? !driverHas : driverHas;
    } else {
      match = prefVal ? driverHas : !driverHas;
    }

    if (match) {
      score++;
    } else {
      // ❗ IMPORTANT: ne PAS faire "hard violation"
      strongViolation = true;
    }
  }

  return {
    score: total === 0 ? 0.5 : score / total,
    hasStrictViolation: strongViolation
  };
}

// ── WEIGHT — PÉNALITÉ DURE SUR VIOLATION STRICTE ─────────────────────────────
//
//   Annulation                       → 0.05
//   Complété sans évaluation         → 0.30
//   Violation stricte (pref bafouée) → 0.00  ← NOUVEAU : signal négatif absolu
//   Bonne note + 0 violation         → noteNorm × 1.0 (max = 1.0)
//   Bonne note + violation partielle → ne peut pas arriver (toutes ou aucune)
//
// LightFM reçoit 0.0 sur toute interaction où une pref a été violée.
// Il apprend ainsi qu'un driver qui viole une pref = expérience nulle.

function computeWeight(trajet, driver) {
  if (trajet.status === "CANCELLED_BY_PASSENGER") {
    return 0.05;
  }

  const { score: pm, hasStrictViolation } = prefMatch(trajet, driver);

  if (!trajet.evaluation) {
    return hasStrictViolation ? 0.10 : 0.30;
  }

  const noteNorm = (trajet.evaluation.rating - 1) / 4;

  // 👇 IMPORTANT: on ne tue JAMAIS le signal
  const base = hasStrictViolation ? 0.4 : 1.0;

  const w = noteNorm * base * (0.5 + 0.5 * pm);

  return Math.max(0.05, Math.min(1, w));
}

// ── EXPORT PRINCIPAL ──────────────────────────────────────────────────────────
async function exportLightFM() {
  console.log("🚀 Export LightFM — exclusion stricte des préférences\n");

  try {
    const drivers = await prisma.driver.findMany({
      where: {
        isVerified:true
      },
      include: { preferences: true, workingHours: true }
    });
    const driverMap = {};
    drivers.forEach((d) => { driverMap[d.id] = d; });

    const trajets = await prisma.trajet.findMany({
      where: {
        status:     { in: ["COMPLETED", "CANCELLED_BY_PASSENGER"] },
        passagerId: { not: null },
        driverId:   { not: null },
      },
      include: { evaluation: true, passenger: true, preferences: true },
    });

  

    console.log(`✅ ${drivers.length} drivers, ${trajets.length} trajets récupérés`);

    const interactions = [];
    const trajetRows   = [];
    let strictViolations = 0;

    for (const t of trajets) {
      const driver = driverMap[t.driverId];
      if (!driver) continue;

      const { hasStrictViolation } = prefMatch(t, driver);
      if (hasStrictViolation) strictViolations++;

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
        quiet_ride:         boolToYesNo(t.preferences?.talkative)        ?? "no",
        radio_ok:           boolToYesNo(t.preferences?.radio)            ?? "no",
        smoking_ok:         boolToYesNo(t.preferences?.smoking)          ?? "no",
        pets_ok:            boolToYesNo(t.preferences?.pets)             ?? "no",
        luggage_large:      boolToYesNo(t.preferences?.luggage_large)    ?? "no",
        female_driver_pref: boolToYesNo(t.preferences?.femal_driver_pref)?? "no",
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
      .map((d) => `D${d.id},${boolToYesNo(d.preferences?.talkative)},${boolToYesNo(d.preferences?.radio)},${boolToYesNo(d.preferences?.smoking)},${boolToYesNo(d.preferences?.pets)},${boolToYesNo(d.preferences?.luggage_large)},${d.sexe?.toLowerCase() === "f" ? "female" : "male"},${(d.avgRating || 4.0).toFixed(1)},${boolToYesNo(d.workingHours?.works_morning)},${boolToYesNo(d.workingHours?.works_afternoon)},${boolToYesNo(d.workingHours?.works_evening)},${boolToYesNo(d.workingHours?.works_night)},${d.latitude ?? "N/A"},${d.longitude ?? "N/A"}`)
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
    const nbZero           = wArr.filter((x) => x === 0.0).length;

    console.log(`\n📊 Résumé export (exclusion stricte) :`);
    console.log(`   Drivers              : ${drivers.length}`);
    console.log(`   Passagers uniques    : ${uniquePassengers}`);
    console.log(`   Interactions totales : ${interactions.length}`);
    console.log(`   Violations strictes  : ${strictViolations} → weight=0.0`);
    console.log(`   Weights à 0.0        : ${nbZero}`);
    console.log(`\n📊 Distribution weights :`);
    console.log(`   ≥ 0.75 (très positif)  : ${wArr.filter((x) => x >= 0.75).length}`);
    console.log(`   0.40–0.75 (positif)    : ${wArr.filter((x) => x >= 0.40 && x < 0.75).length}`);
    console.log(`   0.10–0.40 (neutre)     : ${wArr.filter((x) => x >= 0.10 && x < 0.40).length}`);
    console.log(`   0.0–0.10 (pref violée) : ${wArr.filter((x) => x < 0.10).length}`);
    console.log(`   Contraste max-min      : ${contraste.toFixed(3)}  (> 0.50 = bon signal)`);

    if (contraste < 0.50) {
      console.warn("\n⚠️  Contraste encore faible — vérifier la diversité des prefs dans les trajets");
    } else {
      console.log("\n✅ Contraste ≥ 0.50 — LightFM peut apprendre correctement");
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

computeWeight
