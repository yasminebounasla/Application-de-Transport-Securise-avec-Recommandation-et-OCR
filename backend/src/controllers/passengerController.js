import { prisma } from "../config/prisma.js";

export const addPassengerPreferences = async (req, res) => {
  // On prend l'ID directement depuis le token
  const passengerId = req.user.passengerId;

  if (!passengerId) {
    return res.status(403).json({ message: "Access restricted to passengers only." });
  }

  try {
    const {
      quiet_ride,
      radio_ok,
      smoking_ok,
      pets_ok,
      luggage_large,
      female_driver_pref
    } = req.body;

    const updatedPassenger = await prisma.passenger.update({
      where: { id: passengerId },
      data: { quiet_ride,
              radio_ok, 
              smoking_ok, 
              pets_ok, 
              luggage_large, 
              female_driver_pref 
            }
    });

    res.status(200).json({
      message: "Passenger preferences updated successfully.",
      data: updatedPassenger,
    });

  } catch (err) {
    res.status(500).json({
      message: "Failed to update passenger preferences.",
      error: err.message,
    });
  }
};
   