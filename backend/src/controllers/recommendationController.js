import { getRecommendations } from "../services/recommendationService.js";

export const recommendDrivers = async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = req.body.preferences;

    const drivers = await getRecommendations(userId, preferences);

    res.json({ recommendedDrivers: drivers });

  } catch (error) {
    res.status(500).json({ message: "Failed to get recommendations" });
  }
};
export const getRecommendations = recommendDrivers;