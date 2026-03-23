import { getRecommendations } from "../services/recommendationService.js";
import { prisma } from "../config/prisma.js";

export const recommendDrivers = async (req, res) => {
  console.log("═══════════════════════════════════════════");
  console.log("🎯 [recommendDrivers] req.user:", req.user);
  console.log("🎯 [recommendDrivers] req.body:", JSON.stringify(req.body, null, 2));

  // ── Auth ──────────────────────────────────────────────────────────────────
  const passenger_id = req.user?.passengerId;
  if (!passenger_id) {
    return res.status(400).json({ message: "User not found in request" });
  }

  const {
    trajetId,
    trajet: trajetFromBody = {},       // ✅ objet trajet envoyé par le client
    preferences: preferencesFromClient = {},
    top_n = 5,
  } = req.body;

  // ── Extraire la géo depuis req.body.trajet ────────────────────────────────
  const {
    startLat,
    startLng,
    endLat,
    endLng,
    distanceKm,
    dateDepart,
    heureDepart,
    rideId,
  } = trajetFromBody;

  console.log("📍 [recommendDrivers] Géo extraite de req.body.trajet:", {
    startLat, startLng, endLat, endLng, dateDepart, rideId
  });

  try {
    let mlPreferences = { ...preferencesFromClient, top_n };

    // ── Cas 1 : trajetId fourni → géo depuis DB ───────────────────────────
    if (trajetId) {
      const trajet = await prisma.trajet.findUnique({ where: { id: trajetId } });
      if (!trajet || trajet.passagerId !== passenger_id) {
        return res.status(404).json({ message: "Trajet not found or not owned by this passenger" });
      }
      console.log("📍 [recommendDrivers] Géo depuis DB:", trajet.startLat, trajet.startLng);
      mlPreferences = {
        ...mlPreferences,
        startLat:    trajet.startLat,
        startLng:    trajet.startLng,
        endLat:      trajet.endLat,
        endLng:      trajet.endLng,
        distanceKm:  trajet.distanceKm   ?? null,
        dateDepart:  trajet.departureTime ? new Date(trajet.departureTime).toISOString() : null,
        heureDepart: trajet.departureTime ? new Date(trajet.departureTime).toTimeString().slice(0, 5) : null,
        rideId:      String(trajet.id),
      };
    }

    // ── Cas 2 : géo dans req.body.trajet ─────────────────────────────────
    else if (startLat != null && startLng != null) {
      console.log("📍 [recommendDrivers] Géo depuis client:", startLat, startLng);
      mlPreferences = {
        ...mlPreferences,
        startLat,
        startLng,
        endLat:      endLat      ?? null,
        endLng:      endLng      ?? null,
        distanceKm:  distanceKm  ?? null,
        dateDepart:  dateDepart  ?? new Date().toISOString(),
        heureDepart: heureDepart ?? null,
        rideId:      rideId      ? String(rideId) : null,
      };
    }

    // ── Cas 3 : rien → erreur ─────────────────────────────────────────────
    else {
      console.error("❌ [recommendDrivers] startLat/startLng absents dans req.body.trajet");
      console.error("   req.body.trajet reçu:", trajetFromBody);
      return res.status(400).json({ message: "No trajetId or geolocation provided" });
    }

    console.log("✅ [recommendDrivers] mlPreferences finales:", JSON.stringify(mlPreferences, null, 2));
    console.log("═══════════════════════════════════════════");

    const drivers = await getRecommendations(passenger_id, mlPreferences);
    return res.status(200).json({ recommendedDrivers: drivers });

  } catch (error) {
    console.error("❌ [recommendDrivers] Erreur:", error);
    return res.status(500).json({ message: "Failed to get recommendations" });
  }
};