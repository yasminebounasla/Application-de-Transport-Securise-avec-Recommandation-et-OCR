import { getRecommendations } from "../services/recommendationService";

export const getRecommendations = (req, res) => {

    const { userId, preferences } = req.body;

    try {
        const drivers = await getRecommendations(userId, preferences);
        return res.json({ 
            recommendations: drivers
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur when fetching recommendations' });
    }
}