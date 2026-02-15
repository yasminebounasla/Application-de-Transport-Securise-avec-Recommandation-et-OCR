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
    const { password, ...driverData } = updatedDriver;
    res.status(200).json({
      message: "Driver preferences updated successfully.",
      data: driverData,
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
/**
 * @route   POST /api/drivers/vehicle
 * @desc    Ajouter un véhicule
 */
export const addVehicle = async (req, res) => {
  const driverId = req.user.driverId;
  
  if (!driverId) {
    return res.status(403).json({ 
      message: "Access restricted to drivers only." 
    });
  }

  try {
    const { marque, modele, annee, nbPlaces, plaque, couleur } = req.body;

    if (!marque) {
      return res.status(400).json({ 
        message: "Vehicle brand (marque) is required." 
      });
    }

    const vehicle = await prisma.vehicule.create({
      data: {
        driverId,
        marque,
        modele: modele || null,
        annee: annee ? parseInt(annee) : null,
        nbPlaces: nbPlaces ? parseInt(nbPlaces) : null,
        plaque: plaque || null,
        couleur: couleur || null,
      },
    });

    res.status(201).json({
      message: "Vehicle added successfully.",
      data: vehicle,
    });
  } catch (err) {
    console.error("Error adding vehicle:", err);
    res.status(500).json({
      message: "Failed to add vehicle.",
      error: err.message,
    });
  }
};

/**
 * @route   PUT /api/drivers/vehicle/:vehicleId
 * @desc    Modifier un véhicule
 */
export const updateVehicle = async (req, res) => {
  const driverId = req.user.driverId;
  const { vehicleId } = req.params;

  if (!driverId) {
    return res.status(403).json({ 
      message: "Access restricted to drivers only." 
    });
  }

  try {
    // Vérifier que le véhicule appartient au conducteur
    const existingVehicle = await prisma.vehicule.findFirst({
      where: { 
        id: parseInt(vehicleId), 
        driverId 
      },
    });

    if (!existingVehicle) {
      return res.status(404).json({ 
        message: "Vehicle not found or you don't have permission to update it." 
      });
    }

    const { marque, modele, annee, nbPlaces, plaque, couleur } = req.body;

    // Préparer les données à mettre à jour
    const updateData = {};
    if (marque !== undefined) updateData.marque = marque;
    if (modele !== undefined) updateData.modele = modele;
    if (annee !== undefined) updateData.annee = annee ? parseInt(annee) : null;
    if (nbPlaces !== undefined) updateData.nbPlaces = nbPlaces ? parseInt(nbPlaces) : null;
    if (plaque !== undefined) updateData.plaque = plaque;
    if (couleur !== undefined) updateData.couleur = couleur;

    const updatedVehicle = await prisma.vehicule.update({
      where: { id: parseInt(vehicleId) },
      data: updateData,
    });

    res.status(200).json({
      message: "Vehicle updated successfully.",
      data: updatedVehicle,
    });
  } catch (err) {
    console.error("Error updating vehicle:", err);
    res.status(500).json({
      message: "Failed to update vehicle.",
      error: err.message,
    });
  }
};

/**
 * @route   GET /api/drivers/vehicle
 * @desc    Récupérer tous les véhicules du conducteur
 */
export const getDriverVehicles = async (req, res) => {
  const driverId = req.user.driverId;

  if (!driverId) {
    return res.status(403).json({ 
      message: "Access restricted to drivers only." 
    });
  }

  try {
    const vehicles = await prisma.vehicule.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      message: "Vehicles retrieved successfully.",
      data: vehicles,
      count: vehicles.length,
    });
  } catch (err) {
    console.error("Error retrieving vehicles:", err);
    res.status(500).json({
      message: "Failed to retrieve vehicles.",
      error: err.message,
    });
  }
};

/**
 * @route   DELETE /api/drivers/vehicle/:vehicleId
 * @desc    Supprimer un véhicule
 */
export const deleteVehicle = async (req, res) => {
  const driverId = req.user.driverId;
  const { vehicleId } = req.params;

  if (!driverId) {
    return res.status(403).json({ 
      message: "Access restricted to drivers only." 
    });
  }

  try {
    const existingVehicle = await prisma.vehicule.findFirst({
      where: { 
        id: parseInt(vehicleId), 
        driverId 
      },
    });

    if (!existingVehicle) {
      return res.status(404).json({ 
        message: "Vehicle not found or you don't have permission to delete it." 
      });
    }

    await prisma.vehicule.delete({
      where: { id: parseInt(vehicleId) },
    });

    res.status(200).json({
      message: "Vehicle deleted successfully.",
    });
  } catch (err) {
    console.error("Error deleting vehicle:", err);
    res.status(500).json({
      message: "Failed to delete vehicle.",
      error: err.message,
    });
  }
};

//Récupérer les préférences du conducteur authentifié (Driver only)
export const getDriverPreferences = async (req, res) => {
  const driverId = req.user.driverId;

  if (!driverId) {
    return res.status(403).json({ 
      message: "Access restricted to drivers only." 
    });
  }

  try {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        fumeur: true,
        talkative: true,
        radio_on: true,
        smoking_allowed: true,
        pets_allowed: true,
        car_big: true,
        works_morning: true,
        works_afternoon: true,
        works_evening: true,
        works_night: true,
      },
    });

    if (!driver) {
      return res.status(404).json({ 
        message: "Driver not found." 
      });
    }

    res.status(200).json({
      message: "Driver preferences retrieved successfully.",
      data: driver,
    });
  } catch (err) {
    console.error("Error retrieving driver preferences:", err);
    res.status(500).json({
      message: "Failed to retrieve driver preferences.",
      error: err.message,
    });
  }
};

//Récupérer le profil complet d'un conducteur Public (peut être consulté par n'importe qui)
export const getDriverProfile = async (req, res) => {
  const { id } = req.params;

  try {
    const driver = await prisma.driver.findUnique({
      where: { id: parseInt(id) },
      include: {
        vehicules: {
          select: {
            id: true,
            marque: true,
            modele: true,
            annee: true,
            nbPlaces: true,
            plaque: true,
            couleur: true,
            createdAt: true,
          },
        },
        trajets: {
          where: { 
            status: 'COMPLETED'
          },
          include: {
            evaluation: true  
          },
          orderBy: {
            completedAt: 'desc',
          },
          take: 5,
        },
      },
    });

    if (!driver) {
      return res.status(404).json({ 
        message: "Driver not found." 
      });
    }

    const stats = {
      avgRating: parseFloat((driver.avgRating || 0).toFixed(1)),
      ratingsCount: driver.ratingsCount || 0,
      completedRides: driver.trajets.length,
    };

    const recentFeedbacks = driver.trajets
      .filter(t => t.evaluation)  
      .map(t => ({
        rating: t.evaluation.rating,
        comment: t.evaluation.comment,
        date: t.evaluation.createdAt,
      }));

    const preferences = {
      fumeur: driver.fumeur,
      talkative: driver.talkative,
      radio_on: driver.radio_on,
      smoking_allowed: driver.smoking_allowed,
      pets_allowed: driver.pets_allowed,
      car_big: driver.car_big,
      works_morning: driver.works_morning,
      works_afternoon: driver.works_afternoon,
      works_evening: driver.works_evening,
      works_night: driver.works_night,
    };

    const { 
      password, 
      hasAcceptedPhotoStorage, 
      trajets, 
      ...driverData 
    } = driver;

    res.status(200).json({
      message: "Driver profile retrieved successfully.",
      data: {
        ...driverData,
        vehicules: driver.vehicules,
        preferences,
        stats,
        recentFeedbacks,
        feedbackNote: "For all feedbacks, use GET /api/feedback/public/" + id
      },
    });
  } catch (err) {
    console.error("Error retrieving driver profile:", err);
    res.status(500).json({
      message: "Failed to retrieve driver profile.",
      error: err.message,
    });
  }
};

//Récupérer le profil du conducteur authentifié Private (Driver only)
export const getMyDriverProfile = async (req, res) => {
  const driverId = req.user.driverId;

  if (!driverId) {
    return res.status(403).json({ 
      message: "Access restricted to drivers only." 
    });
  }

  try {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        vehicules: {
          select: {
            id: true,
            marque: true,
            modele: true,
            annee: true,
            nbPlaces: true,
            plaque: true,
            couleur: true,
            createdAt: true,
          },
        },
        trajets: {
          where: { 
            status: 'COMPLETED'
          },
          include: {
            evaluation: true 
          },
          orderBy: {
            completedAt: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!driver) {
      return res.status(404).json({ 
        message: "Driver not found." 
      });
    }

    const stats = {
      avgRating: parseFloat((driver.avgRating || 0).toFixed(1)),
      ratingsCount: driver.ratingsCount || 0,
      completedRides: driver.trajets.length,
    };

    const recentFeedbacks = driver.trajets
      .filter(t => t.evaluation)  
      .map(t => ({
        rating: t.evaluation.rating,
        comment: t.evaluation.comment,
        date: t.evaluation.createdAt,
      }));

    const preferences = {
      fumeur: driver.fumeur,
      talkative: driver.talkative,
      radio_on: driver.radio_on,
      smoking_allowed: driver.smoking_allowed,
      pets_allowed: driver.pets_allowed,
      car_big: driver.car_big,
      works_morning: driver.works_morning,
      works_afternoon: driver.works_afternoon,
      works_evening: driver.works_evening,
      works_night: driver.works_night,
    };

    const { 
      password, 
      hasAcceptedPhotoStorage, 
      trajets, 
      ...driverData 
    } = driver;

    res.status(200).json({
     message: "Your driver profile retrieved successfully.",
     data: {
        ...driverData,
        vehicules: driver.vehicules,
        preferences,
        stats,
        recentFeedbacks: [],
        feedbackNote: "For all feedbacks, use GET /api/feedback/my-feedbacks"  
      },
    });
  } catch (err) {
    console.error("Error retrieving driver profile:", err);
    res.status(500).json({
      message: "Failed to retrieve driver profile.",
      error: err.message,
    });
  }
};

export const updateDriverProfile = async (req, res) => {
  const driverId = req.user.driverId;

  if (!driverId) {
    return res.status(403).json({ 
      message: "Access restricted to drivers only." 
    });
  }

  try {
    const { nom, prenom, numTel, age, sexe } = req.body;

    const updateData = {};
    if (nom !== undefined) updateData.nom = nom;
    if (prenom !== undefined) updateData.prenom = prenom;
    if (numTel !== undefined) updateData.numTel = numTel;
    if (age !== undefined) updateData.age = parseInt(age);
    if (sexe !== undefined) {
      if (sexe !== 'M' && sexe !== 'F') {
        return res.status(400).json({ 
          message: "Gender (sexe) must be 'M' or 'F'." 
        });
      }
      updateData.sexe = sexe;
    }

    const updatedDriver = await prisma.driver.update({
      where: { id: driverId },
      data: updateData,
    });

    const { password, ...driverData } = updatedDriver;

    res.status(200).json({
      message: "Driver profile updated successfully.",
      data: driverData,
    });
  } catch (err) {
    console.error("Error updating driver profile:", err);
    res.status(500).json({
      message: "Failed to update driver profile.",
      error: err.message,
    });
  }
};