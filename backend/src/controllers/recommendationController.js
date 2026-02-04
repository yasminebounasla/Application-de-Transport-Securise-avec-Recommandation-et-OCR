import { getRecommendations } from "../services/recommendationService.js";

export const recommendDrivers = async (req, res) => {
  try {
    const passenger_id = req.user.id;
    const preferences = req.body.preferences || {};
    
    console.log("Controller received:", { passenger_id, preferences }); // Debug
    
    const drivers = await getRecommendations(passenger_id, preferences);
    
    res.json({ recommendedDrivers: drivers });
  } catch (error) {
    console.error("Recommendation error:", error);
    res.status(500).json({ message: "Failed to get recommendations" });
  }
};