import { getRecommendations } from "../services/recommendationService.js";

// Controller pour recommander des drivers à un passager donné, utilisé pour l'endpoint POST /recommendations 
//pour que le frontend puisse envoyer les préférences du passager et recevoir une liste de drivers recommandés en réponse

export const recommendDrivers = async (req, res) => {
  try {
    const passenger_id = req.user.id ; //prendre depuis la session ou le token d'authentification du passager connecté(plus sécurisé)
    const preferences = req.body.preferences || {};
    
    const drivers = await getRecommendations(passenger_id, preferences);
    
    res.json({ recommendedDrivers: drivers });
  } catch (error) {
    console.error("Recommendation error:", error);
    res.status(500).json({ message: "Failed to get recommendations" });
  }
};

