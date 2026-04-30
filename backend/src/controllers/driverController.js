import { prisma } from "../config/prisma.js";
import { getIO } from '../socket/socket.js';
import { extractWilayaFromPlaque } from "../utils/algerianPlaque.js";
import { reverseGeocode }           from "../utils/reverseGeocode.js";
import { extractWilayaFromAddress }  from "../utils/extractWilayaFromAddress.js";

export const addDriverPreferences = async (req, res) => {
  // On prend l'ID directement depuis le token
  const driverId = req.user.driverId;

  if (!driverId) {
    return res.status(403).json({ message: "Access restricted to drivers only." });
  }

  try {
    const {
      talkative,
      radio,
      smoking,
      pets,
      luggage_large,
      femal_driver_pref,
      works_morning,
      works_afternoon,
      works_evening,
      works_night,
    } = req.body;

    const updatedDriver = await prisma.driver.update({
      where: { id: driverId },
      data: {
        preferences: {
          upsert: {
            create: {
              talkative,
              radio,
              smoking,
              pets,
              luggage_large,
              femal_driver_pref,
            },
            update: {
              talkative,
              radio,
              smoking,
              pets,
              luggage_large,
              femal_driver_pref,
            }
          }
        },
        workingHours: {
          upsert: {
            create: {
              works_morning,
              works_afternoon,
              works_evening,
              works_night,
            },
            update: {
              works_morning,
              works_afternoon,
              works_evening,
              works_night,
            }
          }
        }
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

export const getDriverDashboardAnalytics = async (req, res) => {
  const driverId = req.user?.driverId;

  if (!driverId) {
    return res.status(403).json({ message: "Access restricted to drivers only." });
  }

  try {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, createdAt: true, prenom: true, nom: true },
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver not found." });
    }

    const rides = await prisma.trajet.findMany({
      where: {
        OR: [
          { driverId },
          { sentDrivers: { has: driverId } },
        ],
      },
      select: {
        id: true,
        driverId: true,
        sentDrivers: true,
        status: true,
        prix: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        preferences: {
          select: {
            talkative: true,
            radio: true,
            smoking: true,
            pets: true,
            luggage_large: true,
            femal_driver_pref: true,
          }
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const startMonth = new Date(driver.createdAt);
    startMonth.setDate(1);
    startMonth.setHours(0, 0, 0, 0);

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const monthCursor = new Date(startMonth);
    const monthMap = new Map();

    while (monthCursor <= currentMonth) {
      const key = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, {
        key,
        label: monthCursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        requests: 0,
        earnings: 0,
      });
      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }


    const preferenceDefs = [
      { key: 'talkative', label: 'Quiet ride', color: '#16A34A' },
      { key: 'radio', label: 'Music allowed', color: '#2563EB' },
      { key: 'smoking', label: 'Smoking allowed', color: '#DC2626' },
      { key: 'pets', label: 'Pets allowed', color: '#F59E0B' },
      { key: 'luggage_large', label: 'Large luggage', color: '#8B5E3C' },
      { key: 'femal_driver_pref', label: 'Female driver', color: '#EC4899' },
    ];


    const preferenceCounts = Object.fromEntries(
      preferenceDefs.map((pref) => [pref.key, 0])
    );

    let totalEarnings = 0;
    let completedTrips = 0;
    let acceptedTrips = 0;
    let cancelledTrips = 0;

    rides.forEach((ride) => {
      const requestDate = ride.createdAt || ride.updatedAt;
      const requestKey = `${requestDate.getFullYear()}-${String(requestDate.getMonth() + 1).padStart(2, '0')}`;
      const requestBucket = monthMap.get(requestKey);
      if (requestBucket && (ride.driverId === driverId || (ride.sentDrivers || []).includes(driverId))) {
        requestBucket.requests += 1;
      }

      if (ride.driverId === driverId && ride.status === 'COMPLETED') {
        const earningDate = ride.completedAt || ride.updatedAt || ride.createdAt;
        const earningKey = `${earningDate.getFullYear()}-${String(earningDate.getMonth() + 1).padStart(2, '0')}`;
        const earningBucket = monthMap.get(earningKey);
        if (earningBucket) {
          earningBucket.earnings += Number(ride.prix || 0);
        }
        totalEarnings += Number(ride.prix || 0);
        completedTrips += 1;

        preferenceDefs.forEach((pref) => {
          if (ride.preferences?.[pref.key] === true) {
            preferenceCounts[pref.key] += 1;
          }
        });
      }

      if (ride.driverId === driverId && ['ACCEPTED', 'IN_PROGRESS'].includes(ride.status)) {
        acceptedTrips += 1;
      }

      if (ride.driverId === driverId && ['CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER'].includes(ride.status)) {
        cancelledTrips += 1;
      }
    });

    const monthly = Array.from(monthMap.values()).map((item) => ({
      ...item,
      earnings: Number(item.earnings.toFixed(2)),
    }));

    const preferenceBreakdown = preferenceDefs
      .map((pref) => ({
        key: pref.key,
        label: pref.label,
        value: preferenceCounts[pref.key],
        color: pref.color,
      }))
      .filter((item) => item.value > 0);

    return res.status(200).json({
      success: true,
      data: {
        driver: {
          id: driver.id,
          prenom: driver.prenom,
          nom: driver.nom,
          createdAt: driver.createdAt,
        },
        summary: {
          totalEarnings: Number(totalEarnings.toFixed(2)),
          completedTrips,
          acceptedTrips,
          cancelledTrips,
        },
        monthly,
        preferences: preferenceBreakdown,
      },
    });
  } catch (error) {
    console.error("Error retrieving driver dashboard analytics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve driver dashboard analytics.",
      error: error.message,
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

// ── Add vehicle + auto-fill wilaya ────────────────────────────────────────────
export const addVehicle = async (req, res) => {
  const driverId = req.user.driverId;

  if (!driverId) {
    return res.status(403).json({ message: "Access restricted to drivers only." });
  }

  try {
    const { marque, modele, annee, nbPlaces, plaque, couleur } = req.body;

    if (!marque) {
      return res.status(400).json({ message: "Vehicle brand (marque) is required." });
    }

    // ── ✅ Extraire wilaya depuis la plaque ──────────────────────────────────
    let wilayaInfo = null;
    if (plaque) {
      wilayaInfo = extractWilayaFromPlaque(plaque);
      console.log("[addVehicle] plaque:", plaque, "→ wilaya:", wilayaInfo);
    }

    // Créer le véhicule
    const vehicle = await prisma.vehicule.create({
      data: {
        driverId,
        marque,
        modele:   modele   || null,
        annee:    annee    ? parseInt(annee)    : null,
        nbPlaces: nbPlaces ? parseInt(nbPlaces) : null,
        plaque:   plaque   || null,
        couleur:  couleur  || null,
      },
    });

    res.status(201).json({
      message: "Vehicle added successfully.",
      data:    vehicle,
      wilaya:  wilayaInfo ? wilayaInfo.nom : null,
    });
  } catch (err) {
    console.error("Error adding vehicle:", err);
    res.status(500).json({ message: "Failed to add vehicle.", error: err.message });
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
        preferences: {
          select: {
            talkative: true,
            radio: true,
            smoking: true,
            pets: true,
            luggage_large: true,
            femal_driver_pref: true,
          }
        },
        workingHours: {
          select: {
            works_morning: true,
            works_afternoon: true,
            works_evening: true,
            works_night: true,
          }
        }
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
      where:   { id: parseInt(id) },
      include: {
        vehicules: {
          select: {
            id:        true,
            marque:    true,
            modele:    true,
            annee:     true,
            nbPlaces:  true,
            plaque:    true,
            couleur:   true,
            createdAt: true,
          },
        },
        trajets: {
          where:   { status: "COMPLETED" },
          include: { evaluation: true },
          orderBy: { completedAt: "desc" },
          take:    5,
        },
        preferences:  true,
        workingHours: true,
      },
    });

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found.",
      });
    }

    const stats = {
      avgRating:      parseFloat((driver.avgRating || 0).toFixed(1)),
      ratingsCount:   driver.ratingsCount || 0,
      completedRides: driver.trajets.length,
    };

    const recentFeedbacks = driver.trajets
      .filter((t) => t.evaluation)
      .map((t) => ({
        rating:  t.evaluation.rating,
        comment: t.evaluation.comment,
        date:    t.evaluation.createdAt,
      }));

    const preferences = {
      talkative:       driver.preferences?.talkative       ?? false,
      radio_on:        driver.preferences?.radio            ?? false,
      smoking_allowed: driver.preferences?.smoking          ?? false,
      pets_allowed:    driver.preferences?.pets             ?? false,
      car_big:         driver.preferences?.luggage_large    ?? false,
      works_morning:   driver.workingHours?.works_morning   ?? false,
      works_afternoon: driver.workingHours?.works_afternoon ?? false,
      works_evening:   driver.workingHours?.works_evening   ?? false,
      works_night:     driver.workingHours?.works_night     ?? false,
    };

    const {
      password,
      hasAcceptedPhotoStorage,
      trajets,
      email,
      numTel,
      latitude,
      longitude,
      ...driverData
    } = driver;

    res.status(200).json({
      message: "Driver profile retrieved successfully.",
      data: {
        ...driverData,
        vehicules:       driver.vehicules,
        preferences,
        stats,
        recentFeedbacks: [],
        feedbackNote:    "For all feedbacks, use GET /api/feedback/my-feedbacks",
      },
    });

  } catch (err) {
    console.error("Error retrieving driver profile:", err);
    res.status(500).json({
      message: "Failed to retrieve driver profile.",
      error:   err.message,
    });
  }
};

//Récupérer le profil du conducteur authentifié Private (Driver only)
export const getMyDriverProfile = async (req, res) => {
  const driverId = req.user.driverId;

  if (!driverId) {
    return res.status(403).json({
      message: "Access restricted to drivers only.",
    });
  }

  try {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        vehicules: {
          select: {
            id:        true,
            marque:    true,
            modele:    true,
            annee:     true,
            nbPlaces:  true,
            plaque:    true,
            couleur:   true,
            createdAt: true,
          },
        },
        trajets: {
          where:   { status: "COMPLETED" },
          include: { evaluation: true },
          orderBy: { completedAt: "desc" },
          take:    10,
        },
        preferences: true,
        workingHours: true,
      },
    });

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found.",
      });
    }

    const stats = {
      avgRating:      parseFloat((driver.avgRating || 0).toFixed(1)),
      ratingsCount:   driver.ratingsCount || 0,
      completedRides: driver.trajets.length,
    };

    const recentFeedbacks = driver.trajets
      .filter((t) => t.evaluation)
      .map((t) => ({
        rating:  t.evaluation.rating,
        comment: t.evaluation.comment,
        date:    t.evaluation.createdAt,
      }));

    const preferences = {
      talkative:       driver.preferences.talkative,
      radio_on:        driver.preferences.radio,
      smoking_allowed: driver.preferences.smoking,
      pets_allowed:    driver.preferences.pets,
      car_big:         driver.preferences.luggage_large,
      works_morning:   driver.workingHours.works_morning,
      works_afternoon: driver.workingHours.works_afternoon,
      works_evening:   driver.workingHours.works_evening,
      works_night:     driver.workingHours.works_night,
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
        vehicules:    driver.vehicules,
        preferences,
        stats,
        recentFeedbacks,
        feedbackNote: "For all feedbacks, use GET /api/feedback/driver",
      },
    });

  } catch (err) {
    console.error("Error retrieving driver profile:", err);
    res.status(500).json({
      message: "Failed to retrieve driver profile.",
      error:   err.message,
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

// ── ✅ Update location (zone de travail précise) ───────────────────────────────
export const updateDriverLocation = async (req, res) => {
  const driverId = req.user.driverId;

  if (!driverId) {
    return res.status(403).json({ message: "Access restricted to drivers only." });
  }

  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "latitude et longitude sont requis." });
    }

    const driver = await prisma.driver.findUnique({
      where:  { id: driverId },
      select: { wilaya: true },
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver not found." });
    }

    // ✅ Reverse geocode
    const addressObj = await reverseGeocode(latitude, longitude);
    console.log('[location] addressObj:', JSON.stringify(addressObj));

    const wilayaFromCoords = extractWilayaFromAddress(addressObj);
    console.log('[location] wilayaFromCoords:', wilayaFromCoords);
    console.log('[location] driver.wilaya:', driver.wilaya);

    const city = addressObj?.city || addressObj?.town || addressObj?.village || addressObj?.suburb || null;
    const workZoneAddress = city ? `${city}, ${wilayaFromCoords?.nom || ''}` : (wilayaFromCoords?.nom || null);


    await prisma.driver.update({
      where: { id: driverId },
      data: {
       latitude:        parseFloat(latitude),
       longitude:       parseFloat(longitude),
       workZoneAddress: workZoneAddress,
       wilaya:          wilayaFromCoords?.nom || driver.wilaya,
     },
    });

    res.status(200).json({
      message: "Location updated successfully.",
      data: {
        wilaya:    driver.wilaya,
        latitude:  parseFloat(latitude),
        longitude: parseFloat(longitude),
        workZoneAddress: workZoneAddress,
      },
    });

  } catch (err) {
    console.error("Error updating driver location:", err);
    res.status(500).json({ message: "Failed to update location.", error: err.message });
  }
};

export const notifySelectedDrivers = async (req, res) => {
  const passengerId = req.user.passengerId;
  if (!passengerId)
    return res.status(400).json({ success: false, message: "User not found in request" });

  const { rideId, driverIds } = req.body;
  if (!rideId || !driverIds || !Array.isArray(driverIds) || driverIds.length === 0)
    return res.status(400).json({ success: false, message: "rideId et driverIds sont requis" });

  try {
    const ride = await prisma.trajet.findUnique({
      where: { id: parseInt(rideId) },
      include: { passenger: { select: { id: true, nom: true, prenom: true, numTel: true, photoUrl: true } } },
    });

    if (!ride)
      return res.status(404).json({ success: false, message: "Trajet introuvable" });
    if (ride.passagerId !== passengerId)
      return res.status(403).json({ success: false, message: "Ce trajet ne vous appartient pas" });
    if (ride.status !== 'PENDING')
      return res.status(400).json({ success: false, message: "Ce trajet n'est plus disponible" });

    const io = getIO();

    // ← use for...of so await works correctly
    for (const driverId of driverIds) {
      io.to(`driver_${driverId}`).emit('rideRequest', {
        rideId:       ride.id,
        passenger:    ride.passenger,
        startAddress: ride.startAddress,
        endAddress:   ride.endAddress,
        prix:         ride.prix,
        dateDepart:   ride.dateDepart,
        startLat:     ride.startLat,
        startLng:     ride.startLng,
        endLat:       ride.endLat,
        endLng:       ride.endLng,
      });

      // ← persist one notif per driver so acceptRide can find them later
      await createNotification({
        driverId:      Number(driverId),
        recipientType: 'DRIVER',
        type:          'RIDE_REQUEST',
        title:         '🚗 Nouvelle demande',
        message:       `${ride.passenger.prenom} cherche un trajet.`,
        data: { rideId: ride.id, passenger: { prenom: ride.passenger.prenom, nom: ride.passenger.nom, photoUrl: ride.passenger.photoUrl } },
      });
    }

    return res.status(200).json({ success: true, message: `${driverIds.length} conducteur(s) notifié(s)` });

  } catch (error) {
    console.error('Erreur notifySelectedDrivers:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
