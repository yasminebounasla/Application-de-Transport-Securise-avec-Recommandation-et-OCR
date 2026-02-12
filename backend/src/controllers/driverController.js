import { prisma } from "../config/prisma.js";

export const addDriverPreferences = async (req, res) => {
  // On prend l'ID directement depuis le token
  const driverId = req.user.driverId;

  if (!driverId) {
    return res.status(403).json({ message: "Access restricted to drivers only." });
  }

  try {
    const {
      fumeur,
      talkative,
      radio_on,
      smoking_allowed,
      pets_allowed,
      car_big,
      works_morning,
      works_afternoon,
      works_evening,
      works_night,
    } = req.body;

    const updatedDriver = await prisma.driver.update({
      where: { id: driverId },
      data: {
        fumeur,
        talkative,
        radio_on,
        smoking_allowed,
        pets_allowed,
        car_big,
        works_morning,
        works_afternoon,
        works_evening,
        works_night,
      },
    });

    res.status(200).json({
      message: "Driver preferences updated successfully.",
      data: updatedDriver,
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to update driver preferences.",
      error: err.message,
    });
  }
};

// Feedback related controllers
export const getDriverRating = async (req, res) => {
    const driverId = req.user.driverId;

    if (!driverId) {
        return res.status(403).json({ message: "Access restricted to drivers only." });
    }

    try {
        const driver = await prisma.driver.findUnique({
            where: {
                id: driverId
            },
            select: {
                rating: true,
                ratingsCount: true
            }
        });

        if (!driver) {
            return res.status(404).json({
                message: "Driver not found."
            });
        }

        res.status(200).json({
            message: "Driver rating retrieved successfully.",
            data: driver
        });
        
    } catch (err) {
        res.status(500).json({
            message: "Failed to retrieve driver rating.",
            error: err.message
        });
    }
};