import { prisma } from "../config/prisma.js";

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



export const getDriverInteractions = async (req, res) => {
  const passengerId = parseInt(req.params.id);
  
  const trajets = await prisma.trajet.findMany({
    where: {
      passagerId: passengerId,
      status: "COMPLETED",
      driverId: { not: null }
    },
    select: { driverId: true }
  });

  // Compter nb trajets par driver
  const counts = {};
  trajets.forEach(t => {
    counts[t.driverId] = (counts[t.driverId] || 0) + 1;
  });

  return res.status(200).json({ data: counts });
};