import { getRecommendations } from "../services/recommendationService.js";
import { prisma } from "../config/prisma.js";

export const recommendDrivers = async (req, res) => {
  try {
    const passenger_id = req.user?.id || req.body.passenger_id || 0;
    const preferences = req.body.preferences || {};
    
    const drivers = await getRecommendations(passenger_id, preferences);
    
    res.json({ recommendedDrivers: drivers });
  } catch (error) {
    console.error("Recommendation error:", error);
    res.status(500).json({ message: "Failed to get recommendations" });
  }
};

export const bulkDrivers = async (req, res) => {
  try {
    const { driver_ids } = req.body;
    console.log('IDs recherchés:', driver_ids);
    
    // Convertis en Int : "30" -> 30
    const numericIds = driver_ids.map(id => parseInt(id));
    console.log('IDs convertis:', numericIds);
    
    const drivers = await prisma.driver.findMany({
      where: { id: { in: numericIds } },
      include: { vehicules: true }
    });
    
    console.log(`Trouvé ${drivers.length} drivers`);
    res.json(drivers);
  } catch (error) {
    console.error('Bulk error:', error);
    res.status(500).json({ error: error.message });
  }
};