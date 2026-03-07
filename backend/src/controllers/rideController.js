import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket/socket.js';
import { createNotification } from '../controllers/NotificationController.js';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════════════════════════
// createRide — Crée le trajet SANS driver
// Le driver sera assigné après quand un driver accepte
// La recommandation et les notifications sont gérées par sendRideRequests()
// ══════════════════════════════════════════════════════════════════════════════
export const createRide = async (req, res) => {
  console.log("REQ.USER:", req.user);
  const passengerId = req.user.passengerId;

  if (!passengerId) {
    return res.status(400).json({ message: "User not found in request" });
  }

  const {
    startLat, startLng, startAddress,
    endLat, endLng, endAddress,
    departureTime, prix, placesDispo,
  } = req.body;

  if (!startLat || !startLng || !startAddress || !endLat || !endLng || !endAddress || !departureTime) {
    return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' });
  }

  try {
    const passengerExists = await prisma.passenger.findUnique({ where: { id: passengerId } });
    if (!passengerExists) {
      return res.status(404).json({ message: 'Passager introuvable' });
    }

    // Créer le trajet sans driver (driverId sera ajouté à l'acceptation)
    const newRide = await prisma.trajet.create({
      data: {
        passenger: { connect: { id: passengerId } },
        depart:      startAddress,
        destination: endAddress,
        startLat:    parseFloat(startLat),
        startLng:    parseFloat(startLng),
        startAddress,
        endLat:      parseFloat(endLat),
        endLng:      parseFloat(endLng),
        endAddress,
        dateDepart:  new Date(departureTime),
        heureDepart: new Date(departureTime).toTimeString().slice(0, 5),
        placesDispo: placesDispo ? parseInt(placesDispo) : 1,
        prix:        prix ? parseFloat(prix) : 0,
        status:      'PENDING',
      },
      include: {
        passenger: {
          select: { id: true, nom: true, prenom: true, numTel: true, email: true },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Demande de trajet créée avec succès',
      data: newRide,
    });

  } catch (error) {
    console.error('Erreur createRide:', error);
    return res.status(500).json({ message: 'Erreur lors de la création de la demande', error: error.message });
  }
};


// ══════════════════════════════════════════════════════════════════════════════
// sendRideRequests — Notifie les drivers SÉLECTIONNÉS par le passager
// Appelé depuis RecommendedDriversScreen après que le passager
// a choisi ses drivers et cliqué "Notifier X conducteurs"
//
// Body: { rideId, driverIds: [1, 3, 7], preferences }
// ══════════════════════════════════════════════════════════════════════════════
export const sendRideRequests = async (req, res) => {
  const passengerId = req.user.passengerId;
  if (!passengerId) {
    return res.status(400).json({ message: "User not found in request" });
  }

  const { rideId, driverIds, preferences } = req.body;

  if (!rideId || !driverIds || !Array.isArray(driverIds) || driverIds.length === 0) {
    return res.status(400).json({ message: 'rideId et driverIds[] sont requis' });
  }

  try {
    // Récupérer le trajet + passager
    const ride = await prisma.trajet.findUnique({
      where: { id: parseInt(rideId) },
      include: {
        passenger: {
          select: { id: true, nom: true, prenom: true, numTel: true, email: true },
        },
      },
    });

    if (!ride) {
      return res.status(404).json({ message: 'Trajet introuvable' });
    }

    if (ride.passagerId !== passengerId) {
      return res.status(403).json({ message: 'Ce trajet ne vous appartient pas' });
    }

    if (ride.status !== 'PENDING') {
      return res.status(400).json({ message: `Impossible d'envoyer des demandes pour un trajet ${ride.status}` });
    }

    // Récupérer les drivers sélectionnés
    const drivers = await prisma.driver.findMany({
      where: { id: { in: driverIds.map(Number) } },
      select: { id: true, nom: true, prenom: true, email: true },
    });

    if (drivers.length === 0) {
      return res.status(404).json({ message: 'Aucun driver trouvé' });
    }

    const io = getIO();

    // Notifier chaque driver sélectionné (socket + BD)
    for (const driver of drivers) {
      const payload = {
        rideId:       ride.id,
        startAddress: ride.startAddress || ride.depart,
        endAddress:   ride.endAddress   || ride.destination,
        startLat:     ride.startLat,
        startLng:     ride.startLng,
        prix:         ride.prix,
        placesDispo:  ride.placesDispo,
        dateDepart:   ride.dateDepart,
        heureDepart:  ride.heureDepart,
        passenger: {
          id:     ride.passenger.id,
          prenom: ride.passenger.prenom,
          nom:    ride.passenger.nom,
          numTel: ride.passenger.numTel,
          email:  ride.passenger.email,
        },
        preferences: preferences || {},
      };

      // ✅ 1. Sauvegarder en BD (persiste si driver offline)
      await createNotification({
        driverId:      driver.id,
        recipientType: 'DRIVER',
        type:          'RIDE_REQUEST',
        title:         '🚗 Nouvelle demande',
        message:       `${ride.passenger.prenom} ${ride.passenger.nom} · ${ride.startAddress || ride.depart} → ${ride.endAddress || ride.destination}`,
        data:          payload,
      });

      // ✅ 2. Émettre via socket (si driver online, il la reçoit en temps réel)
      io.to(`driver_${driver.id}`).emit('rideRequest', payload);

      console.log(`📨 rideRequest → driver_${driver.id} (${driver.email})`);
    }

    // Notifier le passager (socket uniquement, pas besoin de BD ici)
    io.to(`passenger_${ride.passenger.id}`).emit('rideCreated', {
      rideId:          ride.id,
      status:          ride.status,
      driversNotified: drivers.length,
    });

    return res.status(200).json({
      success: true,
      message: `Demande envoyée à ${drivers.length} conducteur(s)`,
      driversNotified: drivers.length,
    });

  } catch (error) {
    console.error('Erreur sendRideRequests:', error);
    return res.status(500).json({ message: 'Erreur lors de l\'envoi des demandes', error: error.message });
  }
};


// ══════════════════════════════════════════════════════════════════════════════
// getPassengerRides
// ══════════════════════════════════════════════════════════════════════════════
export const getPassengerRides = async (req, res) => {
  const passengerId = req.user.passengerId;
  if (!passengerId) return res.status(400).json({ message: "User not found in request" });

  try {
    const rides = await prisma.trajet.findMany({
      where: { passagerId: passengerId },
      include: {
        driver: {
          select: { id: true, nom: true, prenom: true, numTel: true, avgRating: true, sexe: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ success: true, count: rides.length, data: rides });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la récupération des trajets', error: error.message });
  }
};


// ══════════════════════════════════════════════════════════════════════════════
// getDriverRequests
// ══════════════════════════════════════════════════════════════════════════════
export const getDriverRequests = async (req, res) => {
  const driverId = req.user.driverId;
  if (!driverId) return res.status(400).json({ message: "Driver not found in request" });

  try {
    const driverExists = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driverExists) return res.status(404).json({ message: 'Conducteur introuvable' });

    const pendingRides = await prisma.trajet.findMany({
      where: { status: 'PENDING', driverId: driverId },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true, age: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ success: true, count: pendingRides.length, data: pendingRides });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la récupération des demandes', error: error.message });
  }
};


// ══════════════════════════════════════════════════════════════════════════════
// acceptRide
// ══════════════════════════════════════════════════════════════════════════════
export const acceptRide = async (req, res) => {
  const driverId = req.user.driverId;
  if (!driverId) return res.status(400).json({ success: false, message: "Driver not found in request" });

  const { id } = req.params;
  try {
    const ride = await prisma.trajet.findUnique({ where: { id: parseInt(id) } });
    if (!ride) return res.status(404).json({ success: false, message: 'Demande introuvable' });
    if (ride.status !== 'PENDING') return res.status(400).json({ success: false, message: 'Ce trajet a déjà été pris par un autre conducteur' });

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: { status: 'ACCEPTED', driver: { connect: { id: driverId } }, updatedAt: new Date() },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true } },
        driver:    { select: { id: true, nom: true, prenom: true, numTel: true } },
      },
    });

    const io = getIO();

    // Sauvegarder en BD + notifier le passager
    await createNotification({
      passengerId:   updatedRide.passenger.id,
      recipientType: 'PASSENGER',
      type:          'RIDE_ACCEPTED',
      title:         '✅ Trajet confirmé',
      message:       `${updatedRide.driver.prenom} ${updatedRide.driver.nom} a accepté votre trajet.`,
      data:          { rideId: updatedRide.id, driver: updatedRide.driver },
    });

    io.to(`passenger_${updatedRide.passenger.id}`).emit('rideAccepted', {
      rideId: updatedRide.id,
      status: updatedRide.status,
      driver: updatedRide.driver,
    });

    // Notifier les autres drivers que le trajet est pris
    io.emit('rideTakenByOther', { rideId: updatedRide.id });

    return res.status(200).json({ success: true, message: 'Trajet accepté avec succès', data: updatedRide });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ══════════════════════════════════════════════════════════════════════════════
// rejectRide
// ══════════════════════════════════════════════════════════════════════════════
export const rejectRide = async (req, res) => {
  const driverId = req.user.driverId;
  if (!driverId) return res.status(400).json({ success: false, message: "Driver not found in request" });

  const { id } = req.params;
  try {
    const ride = await prisma.trajet.findUnique({ where: { id: parseInt(id) } });
    if (!ride) return res.status(404).json({ success: false, message: 'Demande de trajet introuvable' });
    if (ride.status !== 'PENDING') return res.status(400).json({ success: false, message: `Impossible de refuser un trajet avec le status ${ride.status}` });
    if (ride.driverId && ride.driverId !== driverId) return res.status(403).json({ success: false, message: "Vous ne pouvez refuser que vos propres demandes" });

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: { status: 'CANCELLED_BY_DRIVER', updatedAt: new Date() },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true } },
        driver:    { select: { id: true, nom: true, prenom: true, numTel: true } },
      },
    });

    const io = getIO();

    await createNotification({
      passengerId:   updatedRide.passenger.id,
      recipientType: 'PASSENGER',
      type:          'RIDE_REJECTED',
      title:         '❌ Demande non acceptée',
      message:       "Votre demande n'a pas pu être prise en charge.",
      data:          { rideId: updatedRide.id },
    });

    io.to(`passenger_${updatedRide.passenger.id}`).emit('rideRejectedByDriver', {
      rideId: updatedRide.id,
      status: updatedRide.status,
      driver: updatedRide.driver,
    });

    return res.status(200).json({ success: true, message: 'Demande refusée avec succès', data: updatedRide });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors du refus de la demande', error: error.message });
  }
};


// ══════════════════════════════════════════════════════════════════════════════
// startRide
// ══════════════════════════════════════════════════════════════════════════════
export const startRide = async (req, res) => {
  const { id } = req.params;
  try {
    const ride = await prisma.trajet.findUnique({ where: { id: parseInt(id) } });
    if (!ride) return res.status(404).json({ success: false, message: 'Trajet introuvable' });
    if (ride.status !== 'ACCEPTED') return res.status(400).json({ success: false, message: `Impossible de démarrer un trajet avec le status ${ride.status}. Le trajet doit être ACCEPTED.` });

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: { status: 'IN_PROGRESS', updatedAt: new Date() },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true } },
        driver:    { select: { id: true, nom: true, prenom: true, numTel: true } },
      },
    });

    const io = getIO();
    io.to(`passenger_${updatedRide.passenger.id}`).emit('rideStarted', {
      rideId: updatedRide.id,
      status: updatedRide.status,
      driver: updatedRide.driver,
    });

    return res.status(200).json({ success: true, message: 'Trajet démarré avec succès', data: updatedRide });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors du démarrage du trajet', error: error.message });
  }
};


// ══════════════════════════════════════════════════════════════════════════════
// completeRide
// ══════════════════════════════════════════════════════════════════════════════
export const completeRide = async (req, res) => {
  const { id } = req.params;
  try {
    const ride = await prisma.trajet.findUnique({ where: { id: parseInt(id) } });
    if (!ride) return res.status(404).json({ success: false, message: 'Trajet introuvable' });
    if (ride.status !== 'IN_PROGRESS') return res.status(400).json({ success: false, message: `Impossible de terminer un trajet avec le status ${ride.status}. Le trajet doit être IN_PROGRESS.` });

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: { status: 'COMPLETED', updatedAt: new Date(), completedAt: new Date() },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true } },
        driver:    { select: { id: true, nom: true, prenom: true } },
      },
    });

    const io = getIO();
    io.to(`passenger_${updatedRide.passenger.id}`).emit('rideCompleted', {
      rideId: updatedRide.id,
      status: updatedRide.status,
    });

    return res.status(200).json({ success: true, message: 'Trajet terminé avec succès', data: updatedRide });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la complétion du trajet', error: error.message });
  }
};


// ══════════════════════════════════════════════════════════════════════════════
// cancelRide
// ══════════════════════════════════════════════════════════════════════════════
export const cancelRide = async (req, res) => {
  const passengerId = req.user.passengerId;
  if (!passengerId) return res.status(400).json({ success: false, message: "User not found in request" });

  const { id } = req.params;
  try {
    const ride = await prisma.trajet.findUnique({ where: { id: parseInt(id) } });
    if (!ride) return res.status(404).json({ success: false, message: 'Trajet introuvable' });
    if (ride.passagerId !== passengerId) return res.status(403).json({ success: false, message: 'Vous ne pouvez annuler que vos propres trajets' });
    if (ride.status === 'COMPLETED' || ride.status.startsWith('CANCELLED')) return res.status(400).json({ success: false, message: `Impossible d'annuler un trajet avec le status ${ride.status}` });

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: { status: 'CANCELLED_BY_PASSENGER', updatedAt: new Date() },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true } },
        driver:    { select: { id: true, nom: true, prenom: true } },
      },
    });

    const io = getIO();
    if (updatedRide.driver) {
      await createNotification({
        driverId:      updatedRide.driver.id,
        recipientType: 'DRIVER',
        type:          'RIDE_CANCELLED',
        title:         '⚠️ Trajet annulé',
        message:       `${updatedRide.passenger.prenom} ${updatedRide.passenger.nom} a annulé sa demande.`,
        data:          { rideId: updatedRide.id, passenger: updatedRide.passenger },
      });

      io.to(`driver_${updatedRide.driver.id}`).emit('rideCancelledByPassenger', {
        rideId:    updatedRide.id,
        status:    updatedRide.status,
        passenger: updatedRide.passenger,
      });
    }

    return res.status(200).json({ success: true, message: 'Trajet annulé avec succès', data: updatedRide });
  } catch (error) {
    return res.status(500).json({ message: "Erreur lors de l'annulation du trajet", error: error.message });
  }
};


export const updateRidePrice = async (req, res) => {
  const { id } = req.params;
  const { prix } = req.body;
  try {
    const updated = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: { prix: parseFloat(prix) },
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};