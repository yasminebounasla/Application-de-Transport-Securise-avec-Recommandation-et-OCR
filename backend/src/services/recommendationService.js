import axios from "axios";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

export const getRecommendations = async (passenger_id, mlPreferences = {}, authToken = null) => {
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
    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

    const headers = {
      "Content-Type": "application/json",
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    };
    
    const [driversRes, interactionsRes] = await Promise.all([
      axios.get(`${BACKEND_URL}/api/auth/driver/all`, {headers}),
      axios.get(`${BACKEND_URL}/api/passengers/${passenger_id}/driver-interactions`, {headers}),
    ]);

    // ── DEBUG COMPLET ──────────────────────────────────────────────────────
    console.log("🔍 driversRes.status:", driversRes.status);
    console.log("🔍 driversRes.data type:", typeof driversRes.data);
    console.log("🔍 driversRes.data keys:", Object.keys(driversRes.data || {}));
    console.log("🔍 driversRes.data.data type:", typeof driversRes.data?.data);
    console.log("🔍 driversRes.data.data isArray:", Array.isArray(driversRes.data?.data));
    console.log("🔍 driversRes.data.data length:", driversRes.data?.data?.length);
    console.log("🔍 premier driver raw:", JSON.stringify(driversRes.data?.data?.[0]).slice(0, 200));

    const driversArray = driversRes.data?.data || driversRes.data;
    console.log("🔍 driversArray final isArray:", Array.isArray(driversArray));
    console.log("🔍 driversArray final length:", driversArray?.length);

    console.log("🔍 interactionsRes.status:", interactionsRes.status);
    console.log("🔍 interaction_counts:", JSON.stringify(interactionsRes.data?.data || {}).slice(0, 100));

    const payload = {
      passenger_id,
      preferences,   // { quiet_ride, smoking_ok, pets_ok, ... }
      trajet,        // { startLat, startLng, endLat, endLng, dateDepart, ... }
      top_n,
      drivers: driversRes.data?.data || driversRes.data,           // ← AJOUT
      interaction_counts: interactionsRes.data?.data || {},         // ← AJOUT
    };

    console.log("🚀 payload.drivers length:", payload.drivers?.length);
    console.log("🚀 payload.drivers isArray:", Array.isArray(payload.drivers));
    console.log("🚀 payload complet (sans drivers):", JSON.stringify({
      passenger_id,
      preferences,
      trajet,
      top_n,
      interaction_counts: payload.interaction_counts,
    }));

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