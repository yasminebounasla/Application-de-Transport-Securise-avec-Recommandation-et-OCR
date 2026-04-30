import axios from "axios";
import { prisma } from "../config/prisma.js";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const buildFallbackRecommendations = (drivers = [], trajet = {}, top_n = 5) => {
  const startLat = trajet?.startLat != null ? Number(trajet.startLat) : null;
  const startLng = trajet?.startLng != null ? Number(trajet.startLng) : null;
  const geoAvailable = Number.isFinite(startLat) && Number.isFinite(startLng);

  const scored = (drivers || []).map((d) => {
    const avgRating = d?.avgRating ?? 4.0;
    let distanceKm = null;

    if (geoAvailable && d?.latitude != null && d?.longitude != null) {
      const lat = Number(d.latitude);
      const lng = Number(d.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        distanceKm = haversineKm(lat, lng, startLat, startLng);
      }
    }

    return {
      ...d,
      ...(distanceKm != null ? { distance_km: Math.round(distanceKm * 10) / 10 } : {}),
      _scores: {
        lightfm: 0.5,
        pref: 0.5,
        dist: 0.5,
        work_ok: true,
        rating: Math.max(0, Math.min(1, (avgRating - 1) / 4)),
      },
    };
  });

  scored.sort((a, b) => {
    const ra = a?.avgRating ?? 0;
    const rb = b?.avgRating ?? 0;
    if (rb !== ra) return rb - ra;
    const da = a?.distance_km ?? Number.POSITIVE_INFINITY;
    const db = b?.distance_km ?? Number.POSITIVE_INFINITY;
    return da - db;
  });

  return scored.slice(0, top_n);
};

// ── RECOMMANDATION ────────────────────────────────────────────────────────────
export const getRecommendations = async (passenger_id, mlPreferences = {}, authToken = null) => {
  const {
    startLat, startLng, endLat, endLng, date,
    distanceKm, dateDepart, heureDepart, rideId,
    top_n = 5,
    ...preferences
  } = mlPreferences;

  const trajet = {
    ...(startLat    != null && { startLat    }),
    ...(startLng    != null && { startLng    }),
    ...(endLat      != null && { endLat      }),
    ...(endLng      != null && { endLng      }),
    ...(distanceKm  != null && { distanceKm  }),
    ...(dateDepart  != null && { dateDepart  }),
    ...(heureDepart != null && { heureDepart }),
    ...(rideId      != null && { rideId      }),
    ...(date        != null && { dateDepart: date instanceof Date ? date.toISOString() : date }),
  };

  try {
    void authToken;

    const passengerIdNum = Number(passenger_id);

    const [drivers, completedTrajets] = await Promise.all([
      prisma.driver.findMany({
        where: { isVerified: true },
        include: { preferences: true, workingHours: true }
      }),
      prisma.trajet.findMany({
        where: {
          passagerId: passengerIdNum,
          status: "COMPLETED",
          driverId: { not: null },
        },
        select: { driverId: true },
      }),
    ]);

    const interaction_counts = {};
    for (const t of completedTrajets) {
      if (t?.driverId == null) continue;
      const key = String(t.driverId);
      interaction_counts[key] = (interaction_counts[key] || 0) + 1;
    }

    const driversFlat = drivers.map((d) => ({
      id: d.id,
      email: d.email,
      nom: d.nom,
      prenom: d.prenom,
      age: d.age,
      numTel: d.numTel,
      sexe: d.sexe,
      avgRating: d.avgRating,
      isVerified: d.isVerified,
      latitude: d.latitude,
      longitude: d.longitude,
      talkative:        d.preferences?.talkative ?? false,
      radio_on:         d.preferences?.radio ?? false,
      smoking_allowed:  d.preferences?.smoking ?? false,
      pets_allowed:     d.preferences?.pets ?? false,
      car_big:          d.preferences?.luggage_large ?? false,
      works_morning:    d.workingHours?.works_morning ?? false,
      works_afternoon:  d.workingHours?.works_afternoon ?? false,
      works_evening:    d.workingHours?.works_evening ?? false,
      works_night:      d.workingHours?.works_night ?? false,
    }));

    const payload = { passenger_id, preferences, trajet, top_n, drivers: driversFlat, interaction_counts };

    const response = await axios.post(`${ML_SERVICE_URL}/recommend`, payload, {
      timeout: 30000,
      headers: { "Content-Type": "application/json" },
    });

    if (!response.data || !Array.isArray(response.data.recommendations)) {
      console.warn("⚠️  Réponse inattendue du ML:", response.data);
      return buildFallbackRecommendations(drivers, trajet, top_n);
    }

    // [FIX] Chaque driver retourné contient driver._scores qui sera sauvegardé
    // en DB (mlScores sur Trajet) lors de sendRideRequests.
    // Ne pas supprimer _scores ici — le controller en a besoin.
    return response.data.recommendations;

  } catch (error) {
    console.error("❌ [getRecommendations] Erreur:", {
      message:      error.message,
      status:       error.response?.status,
      responseData: error.response?.data,
    });

    // Fallback : éviter un écran vide si le ML est down.
    try {
      const drivers = await prisma.driver.findMany({
        where: { isVerified: true },
        include: { preferences: true, workingHours: true }
      });
      return buildFallbackRecommendations(drivers, trajet, top_n);
    } catch (fallbackErr) {
      console.error("❌ [getRecommendations] Fallback DB échoué:", fallbackErr?.message || fallbackErr);
      return [];
    }
  }
};

// ── FEEDBACK ──────────────────────────────────────────────────────────────────
// [FIX] Envoi direct des scores + note à FastAPI /feedback.
// Appelé depuis feedbackController.submitFeedback() après notation du passager.
// Les scores (mlScores) sont lus depuis la DB — plus besoin de fichier log intermédiaire.
// Format attendu par FastAPI : { rating: float, scores: { lightfm, pref, dist, work, rating } }
export const sendFeedback = async (rating, driverScores) => {
  if (!driverScores) {
    console.warn("⚠️  [sendFeedback] scores manquants — feedback ignoré");
    return;
  }

  try {
    await axios.post(
      `${ML_SERVICE_URL}/feedback`,
      { rating, scores: driverScores },
      { timeout: 5000 },
    );
    console.log(`✅ [sendFeedback] Feedback envoyé | note=${rating}`);
  } catch (error) {
    // Non bloquant : FastAPI down ne doit pas planter le feedback passager
    console.error("❌ [sendFeedback] Erreur (non bloquant):", error.message);
  }

};
