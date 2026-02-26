import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket/socket';

const prisma = new PrismaClient();

export const createRide = async (req, res) => {
  console.log("REQ.USER:", req.user); 
  const passengerId = req.user.passengerId;
  
  if (!passengerId) {
    return res.status(400).json({ message: "User not found in request" });
  }

  const {
    startLat,
    startLng,
    startAddress,
    endLat,
    endLng,
    endAddress,
    departureTime,
  } = req.body;

  if (!startLat || !startLng || !startAddress || 
      !endLat || !endLng || !endAddress || !departureTime) {
    return res.status(400).json({ 
      message: 'Tous les champs obligatoires doivent être remplis' 
    });
  }

  try {
    const passengerExists = await prisma.passenger.findUnique({
      where: { id: passengerId }
    });

    if (!passengerExists) {
      return res.status(404).json({ 
        message: 'Passager introuvable' 
      });
    }

    const newRide = await prisma.trajet.create({
      data: {
        passenger: {
          connect: { id: passengerId }
        },
        // ✅ Champs obligatoires ajoutés
        depart: startAddress,
        destination: endAddress,
        // Coordonnées GPS
        startLat: parseFloat(startLat),
        startLng: parseFloat(startLng),
        startAddress,
        endLat: parseFloat(endLat),
        endLng: parseFloat(endLng),
        endAddress,
        dateDepart: new Date(departureTime),
        heureDepart: new Date(departureTime).toTimeString().slice(0, 5),
        placesDispo: 1,
        prix: 0,
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

    return res.status(201).json({
      success: true,
      message: 'Demande de trajet créée avec succès',
      data: newRide
    });

  } catch (error) {
    console.error('Erreur createRide:', error);
    return res.status(500).json({ 
      message: 'Erreur lors de la création de la demande',
      error: error.message 
    });
  }
};



// Récupération des trajets du passager

export const getPassengerRides = async (req, res) => {
  console.log("REQ.USER:", req.user);
  const passengerId = req.user.passengerId;

  if (!passengerId) {
    return res.status(400).json({ message: "User not found in request" });
  }

  try {
    const rides = await prisma.trajet.findMany({
      where: { 
        passagerId: passengerId 
      },

      include: {
        driver: {
          select: { 
            id: true, 
            nom: true, 
            prenom: true, 
            numTel: true, 
            avgRating: true, 
            sexe: true 
          },
        },
      },

      orderBy: { 
        createdAt: 'desc' 
      },
    });

    return res.status(200).json({
      success: true,
      count: rides.length,
      data: rides
    });

  } catch (error) {
    console.error('Erreur getPassengerRides:', error);
    return res.status(500).json({ 
      message: 'Erreur lors de la récupération des trajets',
      error: error.message 
    });
  }
};


// Récupération des demandes pour le driver

export const getDriverRequests = async (req, res) => {

  console.log("REQ.USER:", req.user);

  const driverId = req.user.driverId;

  if (!driverId) {
    return res.status(400).json({ message: "Driver not found in request" });
  }

  try {
    const driverExists = await prisma.driver.findUnique({ where: { id: driverId } });

    if (!driverExists) {
      return res.status(404).json({ message: 'Conducteur introuvable' });
    }

    const pendingRides = await prisma.trajet.findMany({
      where: { 
        status: 'PENDING', 
        driverId: driverId   // fix: récupéré que les requests pour ce driver
      }, 

      include: {
        passenger: {
          select: { id: true, nom: true, prenom: true, numTel: true, age: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      count: pendingRides.length,
      data: pendingRides
    });

  } catch (error) {
    console.error('Erreur getDriverRequests:', error);
    return res.status(500).json({ 
      message: 'Erreur lors de la récupération des demandes',
      error: error.message 
    });
  }
};


// Acceptation d'un trajet

export const acceptRide = async (req, res) => {

  console.log("REQ.USER:", req.user);
  const driverId = req.user.driverId;

  if (!driverId) {
    return res.status(400).json({ 
      success: false,
      message: "Driver not found in request" 
    });
  }

  const { id } = req.params;

  try {
    const ride = await prisma.trajet.findUnique({ where: { id: parseInt(id) } });

    if (!ride) return res.status(404).json({ message: 'Demande de trajet introuvable' });
    if (ride.status !== 'PENDING') return res.status(400).json({ 
      success: false,
      message: `Impossible d'accepter un trajet avec le status ${ride.status}` 
    });

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: { 
        status: 'ACCEPTED',
        driver: { connect: { id: driverId } },
        updatedAt: new Date()
      },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true } },
        driver: { select: { id: true, nom: true, prenom: true, numTel: true } },
      },
    });

    // Notifier passager
    const io = getIO();

    io.to(updatedRide.passenger.id).emit('rideAccepted', {
      rideId: updatedRide.id,
      status: updatedRide.status,
      driver: updatedRide.driver,
    });

    return res.status(200).json({ success: true, message: 'Demande acceptée avec succès', data: updatedRide });

  } catch (error) {
    console.error('Erreur acceptRide:', error);
    return res.status(500).json({ message: 'Erreur lors de l\'acceptation de la demande', error: error.message });
  }
};


// Refus d'un trajet par le driver 
export const rejectRide = async (req, res) => {
  const driverId = req.user.driverId; // FIX: récup driver

  if (!driverId) return res.status(400).json({ 
    success: false, 
    message: "Driver not found in request" 
  });

  const { id } = req.params;

  try {

    const ride = await prisma.trajet.findUnique({ 
      where: { 
        id: parseInt(id) 
      } 
    });

    if (!ride) return res.status(404).json({ 
      success: false,
      message: 'Demande de trajet introuvable'
     });

    if (ride.status !== 'PENDING') return res.status(400).json({ 
      success: false,
      message: `Impossible de refuser un trajet avec le status ${ride.status}` 
    });

    //  Vérif driver
    if (ride.driverId && ride.driverId !== driverId) {
      return res.status(403).json({ 
        success: false,
        message: "Vous ne pouvez refuser que vos propres demandes" 
      });
    }

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: { status: 'CANCELLED_BY_DRIVER', updatedAt: new Date() },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true } },
        driver: { select: { id: true, nom: true, prenom: true, numTel: true } }
      },
    });

    // Notifier passager
    const io = getIO();

    io.to(updatedRide.passenger.id).emit('rideRejectedByDriver', {
      rideId: updatedRide.id,
      status: updatedRide.status,
      driver: updatedRide.driver
    });

    return res.status(200).json({ success: true, message: 'Demande refusée avec succès', data: updatedRide });

  } catch (error) {
    console.error('Erreur rejectRide:', error);
    return res.status(500).json({ message: 'Erreur lors du refus de la demande', error: error.message });
  }
};


// Démarrer un trajet
export const startRide = async (req, res) => {
  const { id } = req.params;

  try {
    const ride = await prisma.trajet.findUnique({ 
      where: { 
        id: parseInt(id) 
      } 
    });

    if (!ride) return res.status(404).json({ 
      success: false, 
      message: 'Trajet introuvable' 
    });

    if (ride.status !== 'ACCEPTED') return res.status(400).json({ 
      success: false, 
      message: `Impossible de démarrer un trajet avec le status ${ride.status}. Le trajet doit être ACCEPTED.` 
    });

    const updatedRide = await prisma.trajet.update({
      where: { 
        id: parseInt(id) 
      },
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
            numTel: true 
          } 
        },

        driver: { 
          select: { 
            id: true, 
            nom: true, 
            prenom: true, 
            numTel: true 
          } 
        },
      },
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Trajet démarré avec succès', data: updatedRide 
    });

  } catch (error) {
    console.error('Erreur startRide:', error);
    return res.status(500).json({ message: 'Erreur lors du démarrage du trajet', error: error.message });
  }
};


// Terminer un trajet
export const completeRide = async (req, res) => {
  const { id } = req.params;

  try {

    const ride = await prisma.trajet.findUnique({ 
      where: { 
        id: parseInt(id) 
      }
    });

    if (!ride) return res.status(404).json({ 
      success: false,
      message: 'Trajet introuvable' 
    });

    if (ride.status !== 'IN_PROGRESS') return res.status(400).json({ 
      success: false,
      message: `Impossible de terminer un trajet avec le status ${ride.status}. Le trajet doit être IN_PROGRESS.` 
    });

    const updatedRide = await prisma.trajet.update({
      where: { 
        id: parseInt(id) 
      },
      data: { 
        status: 'COMPLETED', 
        updatedAt: new Date(), 
        completedAt: new Date() 
      }, 
      include: {
        passenger: { 
          select: { 
            id: true, 
            nom: true, 
            prenom: true 
          } 
        },
        driver: { 
          select: { 
            id: true, 
            nom: true, 
            prenom: true 
          } 
        },
      },
    });

    return res.status(200).json({ 
      success: true, message: 'Trajet terminé avec succès', 
      data: updatedRide 
    });

  } catch (error) {
    console.error('Erreur completeRide:', error);
    return res.status(500).json({ message: 'Erreur lors de la complétion du trajet', error: error.message });
  }
};


// Annuler un trajet par le passager

export const cancelRide = async (req, res) => {
  console.log("REQ.USER:", req.user);
  const passengerId = req.user.passengerId;

  if (!passengerId) return res.status(400).json({ 
    success: false,
    message: "User not found in request" 
  });

  const { id } = req.params;

  try {
    const ride = await prisma.trajet.findUnique({ 
      where: { 
        id: parseInt(id) 
      }
     });

    if (!ride) return res.status(404).json({ 
      success: false,
      message: 'Trajet introuvable' 
    });

    if (ride.passagerId !== passengerId) {
      return res.status(403).json({ 
        success: false,
        message: 'Vous ne pouvez annuler que vos propres trajets' 
      });
    }

    if (ride.status === 'COMPLETED' || ride.status.startsWith('CANCELLED')) {
      return res.status(400).json({ 
        success: false, 
        message: `Impossible d'annuler un trajet avec le status ${ride.status}` 
      });
    }

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: { status: 'CANCELLED_BY_PASSENGER', updatedAt: new Date() },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true } },
        driver: { select: { id: true, nom: true, prenom: true } } //  On récupère driver si exist
      }
    });

    // Notifier driver si le trajet avait été accepté
    const io = getIO();
    
    if (updatedRide.driver) {
      io.to(updatedRide.driver.id).emit('rideCancelledByPassenger', {
        rideId: updatedRide.id,
        status: updatedRide.status,
        passenger: updatedRide.passenger
      });
    }

    return res.status(200).json({ success: true, message: 'Trajet annulé avec succès', data: updatedRide });

  } catch (error) {
    console.error('Erreur cancelRide:', error);
    return res.status(500).json({ message: 'Erreur lors de l\'annulation du trajet', error: error.message });
  }
};