import axios from "axios";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

export const getRecommendations = async (passenger_id, mlPreferences = {}) => {
  console.log("═══════════════════════════════════════════");
  console.log("📡 [getRecommendations] ML_SERVICE_URL:", ML_SERVICE_URL);
  console.log("📡 [getRecommendations] passenger_id:", passenger_id);
  console.log("📡 [getRecommendations] mlPreferences reçues:", JSON.stringify(mlPreferences, null, 2));

  // ── Extraire les champs trajet depuis mlPreferences ──────────────────────
  const {
    startLat,
    startLng,
    endLat,
    endLng,
    date,
    distanceKm,
    dateDepart,
    heureDepart,
    rideId,
    top_n = 5,
    ...preferences           // tout le reste = préférences passager
  } = mlPreferences;

  // ── Construire l'objet trajet séparé ─────────────────────────────────────
  const trajet = {
    ...(startLat  != null && { startLat  }),
    ...(startLng  != null && { startLng  }),
    ...(endLat    != null && { endLat    }),
    ...(endLng    != null && { endLng    }),
    ...(distanceKm!= null && { distanceKm}),
    ...(dateDepart!= null && { dateDepart}),
    ...(heureDepart!=null && { heureDepart}),
    ...(rideId    != null && { rideId    }),
    ...(date      != null && { dateDepart: date instanceof Date
          ? date.toISOString()
          : date }),
  };

  console.log("📦 [getRecommendations] trajet extrait:", JSON.stringify(trajet, null, 2));
  console.log("🎛️  [getRecommendations] preferences extraites:", JSON.stringify(preferences, null, 2));
  console.log("═══════════════════════════════════════════");

  // ── Validation ────────────────────────────────────────────────────────────
  if (trajet.startLat == null || trajet.startLng == null) {
    console.warn("⚠️  [getRecommendations] startLat/startLng manquants dans trajet — distance désactivée côté ML");
  }

  try {
    const payload = {
      passenger_id,
      preferences,   // { quiet_ride, smoking_ok, pets_ok, ... }
      trajet,        // { startLat, startLng, endLat, endLng, dateDepart, ... }
      top_n,
    };

    console.log("🚀 [getRecommendations] Payload envoyé au ML:\n", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${ML_SERVICE_URL}/recommend`,
      payload,
      {
        timeout: 30000,
        headers: { "Content-Type": "application/json" },
      }
    );

    console.log("✅ [getRecommendations] Réponse ML status:", response.status);
    console.log("✅ [getRecommendations] Nombre drivers reçus:", response.data?.recommendations?.length ?? 0);

    if (!response.data || !Array.isArray(response.data.recommendations)) {
      console.warn("⚠️  [getRecommendations] Réponse inattendue du ML:", response.data);
      return [];
    }

    return response.data.recommendations;

  } catch (error) {
    console.error("❌ [getRecommendations] Erreur service ML:", {
      message:      error.message,
      status:       error.response?.status,
      responseData: error.response?.data,
    });
    return [];
  }
};