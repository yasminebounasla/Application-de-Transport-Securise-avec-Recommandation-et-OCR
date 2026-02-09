import { getRecommendations } from "../services/recommendationService.js";

// RECOMMENDATION CONTROLLER
export const recommendDrivers = async (req, res) => {
  console.log("REQ.USER:", req.user);

  const passenger_id = req.user.passengerId;
  if (!passenger_id) return res.status(400).json({ message: "User not found in request" });

  const preferences = req.body.preferences || {};

  try {
    const drivers = await getRecommendations(passenger_id, preferences);
    return res.status(200).json({ 
      recommendedDrivers: drivers 
    });

  } catch (error) {

    console.error("Recommendation error:", error);
    res.status(500).json({ 
      message: "Failed to get recommendations" 
    });
  }
};
