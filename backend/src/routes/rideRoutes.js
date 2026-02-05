import express from 'express';
import { calculateRoute, estimateTripDuration, getAlternativeRoutes } from '../services/geoService.js';
import { validateAlgeriaLocations } from '../utils/validateLocation.js';

const router = express.Router();

// POST /api/ride/calculate
router.post('/calculate', validateAlgeriaLocations, async (req, res) => {
  try {
    const { start, end } = req.body;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'Start and end locations are required'
      });
    }

    const result = await calculateRoute(start, end);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);

  } catch (error) {
    console.error('Route calculation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/ride/estimate
router.post('/estimate',validateAlgeriaLocations, async (req, res) => {
  try {
    const { start, end } = req.body;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'Start and end locations are required'
      });
    }

    const result = await estimateTripDuration(start, end);

    res.json(result);

  } catch (error) {
    console.error('Duration estimation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/ride/alternatives
router.post('/alternatives',validateAlgeriaLocations, async (req, res) => {
  try {
    const { start, end, numAlternatives } = req.body;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'Start and end locations are required'
      });
    }

    const result = await getAlternativeRoutes(start, end, numAlternatives);

    res.json(result);

  } catch (error) {
    console.error('Alternative routes error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;