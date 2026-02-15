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
    
    const { password, ...passengerData } = updatedPassenger;
    
    res.status(200).json({
      message: "Passenger preferences updated successfully.",
      data: passengerData,
    });

  } catch (err) {
    res.status(500).json({
      message: "Failed to update passenger preferences.",
      error: err.message,
    });
  }
};

// Récupérer les préférences du passager authentifié Private (Passenger only)
export const getPassengerPreferences = async (req, res) => {
  const passengerId = req.user.passengerId;

  if (!passengerId) {
    return res.status(403).json({ 
      message: "Access restricted to passengers only." 
    });
  }

  try {
    const passenger = await prisma.passenger.findUnique({
      where: { id: passengerId },
      select: {
        id: true,
        quiet_ride: true,
        radio_ok: true,
        smoking_ok: true,
        pets_ok: true,
        luggage_large: true,
        female_driver_pref: true,
      },
    });

    if (!passenger) {
      return res.status(404).json({ 
        message: "Passenger not found." 
      });
    }

    res.status(200).json({
      message: "Passenger preferences retrieved successfully.",
      data: passenger,
    });
  } catch (err) {
    console.error("Error retrieving passenger preferences:", err);
    res.status(500).json({
      message: "Failed to retrieve passenger preferences.",
      error: err.message,
    });
  }
};

//Récupérer le profil complet du passager authentifié Private (Passenger only)
export const getMyPassengerProfile = async (req, res) => {
  const passengerId = req.user.passengerId;

  if (!passengerId) {
    return res.status(403).json({ 
      message: "Access restricted to passengers only." 
    });
  }

  try {
    const passenger = await prisma.passenger.findUnique({
      where: { id: passengerId },
      include: {
        trajets: {
          where: { 
            status: 'COMPLETED'
          },
          include: {
            driver: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                avgRating: true,
              }
            }
          },
          orderBy: {
            completedAt: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!passenger) {
      return res.status(404).json({ 
        message: "Passenger not found." 
      });
    }

    // Préférences
    const preferences = {
      quiet_ride: passenger.quiet_ride,
      radio_ok: passenger.radio_ok,
      smoking_ok: passenger.smoking_ok,
      pets_ok: passenger.pets_ok,
      luggage_large: passenger.luggage_large,
      female_driver_pref: passenger.female_driver_pref,
    };

    // Historique des trajets
    const ridesHistory = passenger.trajets.map(t => ({
      id: t.id,
      startAddress: t.startAddress,
      endAddress: t.endAddress,
      dateDepart: t.dateDepart,
      prix: t.prix,
      status: t.status,
      completedAt: t.completedAt,
      driver: t.driver,
    }));

    const stats = {
      totalRides: passenger.trajets.length,
      completedRides: passenger.trajets.filter(t => t.status === 'COMPLETED').length,
    };

    const { 
      password, 
      trajets,
      ...passengerData 
    } = passenger;

    res.status(200).json({
      message: "Your passenger profile retrieved successfully.",
      data: {
        ...passengerData,
        preferences,
        stats,
        ridesHistory,
      },
    });
  } catch (err) {
    console.error("Error retrieving passenger profile:", err);
    res.status(500).json({
      message: "Failed to retrieve passenger profile.",
      error: err.message,
    });
  }
};

//Récupérer le profil public d'un passager
export const getPassengerProfile = async (req, res) => {
  const { id } = req.params;

  try {
    const passenger = await prisma.passenger.findUnique({
      where: { id: parseInt(id) },
    });

    if (!passenger) {
      return res.status(404).json({ 
        message: "Passenger not found." 
      });
    }

    const preferences = {
      quiet_ride: passenger.quiet_ride,
      radio_ok: passenger.radio_ok,
      smoking_ok: passenger.smoking_ok,
      pets_ok: passenger.pets_ok,
      luggage_large: passenger.luggage_large,
      female_driver_pref: passenger.female_driver_pref,
    };

    const { 
      password, 
      email,
      numTel,
      ...publicData 
    } = passenger;

    res.status(200).json({
      message: "Passenger profile retrieved successfully.",
      data: {
        ...publicData,
        preferences,
      },
    });
  } catch (err) {
    console.error("Error retrieving passenger profile:", err);
    res.status(500).json({
      message: "Failed to retrieve passenger profile.",
      error: err.message,
    });
  }
};

//Modifier les informations personnelles du passager Private (Passenger only)
export const updatePassengerProfile = async (req, res) => {
  const passengerId = req.user.passengerId;

  if (!passengerId) {
    return res.status(403).json({ 
      message: "Access restricted to passengers only." 
    });
  }

  try {
    const { nom, prenom, numTel, age } = req.body;

    const updateData = {};
    if (nom !== undefined) updateData.nom = nom;
    if (prenom !== undefined) updateData.prenom = prenom;
    if (numTel !== undefined) updateData.numTel = numTel;
    if (age !== undefined) updateData.age = parseInt(age);

    const updatedPassenger = await prisma.passenger.update({
      where: { id: passengerId },
      data: updateData,
    });

    const { password, ...passengerData } = updatedPassenger;

    res.status(200).json({
      message: "Passenger profile updated successfully.",
      data: passengerData,
    });
  } catch (err) {
    console.error("Error updating passenger profile:", err);
    res.status(500).json({
      message: "Failed to update passenger profile.",
      error: err.message,
    });
  }
};