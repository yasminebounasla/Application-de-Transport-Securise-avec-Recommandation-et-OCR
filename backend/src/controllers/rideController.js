import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createRide = async (req, res) => {
  try {
    const {
      passengerId,
      startLat,
      startLng,
      startAddress,
      endLat,
      endLng,
      endAddress,
      departureTime,
      noSmoking,
      noPets,
      quiet,
    } = req.body;

    if (!passengerId || !startLat || !startLng || !startAddress || 
        !endLat || !endLng || !endAddress || !departureTime) {
      return res.status(400).json({ 
        message: 'Tous les champs obligatoires doivent être remplis' 
      });
    }

    const passengerExists = await prisma.passenger.findUnique({
      where: { id: parseInt(passengerId) }
    });

    if (!passengerExists) {
      return res.status(404).json({ 
        message: 'Passager introuvable' 
      });
    }

    const newRide = await prisma.ride.create({
      data: {
        passengerId: parseInt(passengerId),
        startLat: parseFloat(startLat),
        startLng: parseFloat(startLng),
        startAddress,
        endLat: parseFloat(endLat),
        endLng: parseFloat(endLng),
        endAddress,
        departureTime: new Date(departureTime),
        noSmoking: noSmoking || false,
        noPets: noPets || false,
        quiet: quiet || false,
        status: 'PENDING',
      },
      include: {
        passenger: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            numTel: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Demande de trajet créée avec succès',
      data: newRide
    });

  } catch (error) {
    console.error('❌ Erreur createRide:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la création de la demande',
      error: error.message 
    });
  }
};

export const getPassengerRides = async (req, res) => {
  try {
    const { id } = req.params;

    const passengerExists = await prisma.passenger.findUnique({
      where: { id: parseInt(id) }
    });

    if (!passengerExists) {
      return res.status(404).json({ 
        success: false,
        message: 'Passager introuvable' 
      });
    }

    const rides = await prisma.ride.findMany({
      where: {
        passengerId: parseInt(id),
      },
      include: {
        driver: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            numTel: true,
            note: true,
            sexe: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      success: true,
      count: rides.length,
      data: rides
    });

  } catch (error) {
    console.error('❌ Erreur getPassengerRides:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération des trajets',
      error: error.message 
    });
  }
};

export const getDriverRequests = async (req, res) => {
  try {
    const { id } = req.params;

    const driverExists = await prisma.driver.findUnique({
      where: { id: parseInt(id) }
    });

    if (!driverExists) {
      return res.status(404).json({ 
        success: false,
        message: 'Conducteur introuvable' 
      });
    }

    const pendingRides = await prisma.ride.findMany({
      where: {
        status: 'PENDING',

      },
      include: {
        passenger: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            numTel: true,
            age: true,
            quiet_ride: true,
            smoking_ok: true,
            pets_ok: true,
            luggage_large: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      success: true,
      count: pendingRides.length,
      data: pendingRides
    });

  } catch (error) {
    console.error('❌ Erreur getDriverRequests:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération des demandes',
      error: error.message 
    });
  }
};

export const rejectRide = async (req, res) => {
  try {
    const { id } = req.params;

    const ride = await prisma.ride.findUnique({
      where: { id: parseInt(id) }
    });

    if (!ride) {
      return res.status(404).json({ 
        success: false,
        message: 'Demande de trajet introuvable' 
      });
    }

    if (ride.status !== 'PENDING') {
      return res.status(400).json({ 
        success: false,
        message: `Impossible de refuser un trajet avec le status ${ride.status}` 
      });
    }

    const updatedRide = await prisma.ride.update({
      where: { id: parseInt(id) },
      data: { 
        status: 'CANCELLED',
        updatedAt: new Date()
      },
      include: {
        passenger: {
          select: {
            id: true,
            nom: true,
            prenom: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Demande refusée avec succès',
      data: updatedRide
    });

  } catch (error) {
    console.error('❌ Erreur rejectRide:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors du refus de la demande',
      error: error.message 
    });
  }
};

export const startRide = async (req, res) => {
  try {
    const { id } = req.params;

    const ride = await prisma.ride.findUnique({
      where: { id: parseInt(id) }
    });

    if (!ride) {
      return res.status(404).json({ 
        success: false,
        message: 'Trajet introuvable' 
      });
    }

    if (ride.status !== 'ACCEPTED') {
      return res.status(400).json({ 
        success: false,
        message: `Impossible de démarrer un trajet avec le status ${ride.status}. Le trajet doit être ACCEPTED.` 
      });
    }

    const updatedRide = await prisma.ride.update({
      where: { id: parseInt(id) },
      data: { 
        status: 'IN_PROGRESS',
        updatedAt: new Date()
      },
      include: {
        passenger: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            numTel: true,
          },
        },
        driver: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            numTel: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Trajet démarré avec succès',
      data: updatedRide
    });

  } catch (error) {
    console.error('❌ Erreur startRide:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors du démarrage du trajet',
      error: error.message 
    });
  }
};

export const completeRide = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le ride existe
    const ride = await prisma.ride.findUnique({
      where: { id: parseInt(id) }
    });

    if (!ride) {
      return res.status(404).json({ 
        success: false,
        message: 'Trajet introuvable' 
      });
    }

    if (ride.status !== 'IN_PROGRESS') {
      return res.status(400).json({ 
        success: false,
        message: `Impossible de terminer un trajet avec le status ${ride.status}. Le trajet doit être IN_PROGRESS.` 
      });
    }

    const updatedRide = await prisma.ride.update({
      where: { id: parseInt(id) },
      data: { 
        status: 'COMPLETED',
        updatedAt: new Date()
      },
      include: {
        passenger: {
          select: {
            id: true,
            nom: true,
            prenom: true,
          },
        },
        driver: {
          select: {
            id: true,
            nom: true,
            prenom: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Trajet terminé avec succès',
      data: updatedRide
    });

  } catch (error) {
    console.error('❌ Erreur completeRide:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la complétion du trajet',
      error: error.message 
    });
  }
};

export const cancelRide = async (req, res) => {
  try {
    const { id } = req.params;

    const ride = await prisma.ride.findUnique({
      where: { id: parseInt(id) }
    });

    if (!ride) {
      return res.status(404).json({ 
        success: false,
        message: 'Trajet introuvable' 
      });
    }

    if (ride.status === 'COMPLETED' || ride.status === 'CANCELLED') {
      return res.status(400).json({ 
        success: false,
        message: `Impossible d'annuler un trajet avec le status ${ride.status}` 
      });
    }

    const updatedRide = await prisma.ride.update({
      where: { id: parseInt(id) },
      data: { 
        status: 'CANCELLED',
        updatedAt: new Date()
      },
      include: {
        passenger: {
          select: {
            id: true,
            nom: true,
            prenom: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Trajet annulé avec succès',
      data: updatedRide
    });

  } catch (error) {
    console.error('❌ Erreur cancelRide:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de l\'annulation du trajet',
      error: error.message 
    });
  }
};