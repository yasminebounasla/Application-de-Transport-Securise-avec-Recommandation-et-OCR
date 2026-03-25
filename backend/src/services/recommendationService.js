import axios from "axios";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const BACKEND_URL    = process.env.BACKEND_URL    || "http://localhost:5000";

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
    const authHeaders = {
      "Content-Type": "application/json",
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    };

    const [driversRes, interactionsRes] = await Promise.all([
      axios.get(`${BACKEND_URL}/api/auth/driver/all`, { headers: authHeaders }),
      axios.get(`${BACKEND_URL}/api/passengers/${passenger_id}/driver-interactions`, { headers: authHeaders }),
    ]);

    const payload = {
      passenger_id,
      preferences,
      trajet,
      top_n,
      drivers:            driversRes.data?.data     || driversRes.data     || [],
      interaction_counts: interactionsRes.data?.data || interactionsRes.data || {},
    };

    const response = await axios.post(`${ML_SERVICE_URL}/recommend`, payload, {
      timeout: 30000,
      headers: { "Content-Type": "application/json" },
    });

    if (!response.data || !Array.isArray(response.data.recommendations)) {
      console.warn("⚠️  Réponse inattendue du ML:", response.data);
      return [];
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
    return [];
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