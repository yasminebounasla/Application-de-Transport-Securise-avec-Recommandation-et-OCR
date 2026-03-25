import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket/socket.js';
import { createNotification } from './NotificationController.js';

const prisma = new PrismaClient();

const parseAndValidateId = (rawId) => {
  const id = Number.parseInt(rawId, 10);
  return Number.isNaN(id) ? null : id;
};

// ── Map en mémoire pour stocker les timeouts par driver par trajet ─────────────
// clé : `${trajetId}_${driverId}` → valeur : timeoutId
const pendingTimeouts = new Map();

const SIX_HOURS = 6 * 60 * 60 * 1000;

// ── Fonction utilitaire : évaluer si tous les drivers ont répondu ──────────────
const evaluateTrajet = async (trajetId) => {
  const ride = await prisma.trajet.findUnique({ where: { id: trajetId } });
  if (!ride || ride.status !== 'PENDING') return;

  const resolvedCount = ride.rejectedDriverIds.length + ride.timedOutDriverIds.length;
  const allResolved = resolvedCount >= ride.notifiedDriversCount;

  if (!allResolved) return;

  await prisma.trajet.update({
    where: { id: trajetId },
    data: { status: 'CANCELLED_BY_DRIVER' },
  });

  const io = getIO();
  const title   = '❌ Demande refusée';
  const message = `Votre demande de trajet a été refusée par tous les conducteurs.`;

  io.to(`passenger_${ride.passagerId}`).emit('rideRejectedByDriver', {
    rideId: ride.id,
    status: 'CANCELLED_BY_DRIVER',
    title,
    message,
  });

  await createNotification({
    passengerId:   ride.passagerId,
    recipientType: 'PASSENGER',
    type:          'RIDE_REJECTED',
    title,
    message,
    data: { rideId: ride.id },
  });
};

// ── Fonction utilitaire : démarrer le timeout pour un driver ──────────────────
export const scheduleDriverTimeout = (trajetId, driverId, dateDepart) => {
  const timeAvailable = new Date(dateDepart) - Date.now();
  const timeout = Math.min(timeAvailable / 2, SIX_HOURS);

  const key = `${trajetId}_${driverId}`;

  const timeoutId = setTimeout(async () => {
    pendingTimeouts.delete(key);

    // Vérifier que le driver n'a pas déjà répondu
    const ride = await prisma.trajet.findUnique({ where: { id: trajetId } });
    if (!ride || ride.status !== 'PENDING') return;
    if (ride.rejectedDriverIds.includes(driverId)) return;

    console.log(`⏱️ Timeout driver ${driverId} pour trajet ${trajetId}`);

    await prisma.trajet.update({
      where: { id: trajetId },
      data: {
        timedOutDriverIds: { push: driverId },
        updatedAt: new Date(),
      },
    });

    await evaluateTrajet(trajetId);
  }, timeout);

  pendingTimeouts.set(key, timeoutId);
};

// ── Annuler le timeout d'un driver (quand il répond explicitement) ─────────────
const clearDriverTimeout = (trajetId, driverId) => {
  const key = `${trajetId}_${driverId}`;
  const timeoutId = pendingTimeouts.get(key);
  if (timeoutId) {
    clearTimeout(timeoutId);
    pendingTimeouts.delete(key);
  }
};

export const createRide = async (req, res) => {
  console.log("REQ.USER:", req.user);
  const passengerId = req.user.passengerId;

  if (!passengerId) {
    return res.status(400).json({ message: "User not found in request" });
  }

  const {
    startLat, startLng, startAddress,
    endLat, endLng, endAddress,
    departureTime,
  } = req.body;

  if (!startLat || !startLng || !startAddress ||
    !endLat || !endLng || !endAddress || !departureTime) {
    return res.status(400).json({
      message: 'Tous les champs obligatoires doivent être remplis'
    });
  }

  const now = new Date();
  const departure = new Date(departureTime);
  const diffMs = departure.getTime() - now.getTime();
  const diffMin = diffMs / 60_000;
  const diffDays = diffMs / 86_400_000;

  if (isNaN(departure.getTime()))
    return res.status(400).json({ message: "Format de date invalide." });
  if (diffMin < 30)
    return res.status(400).json({ message: "RIDE_TOO_SOON: Le départ doit être au moins 30 minutes dans le futur." });
  if (diffDays > 30)
    return res.status(400).json({ message: "RIDE_TOO_FAR: Le départ ne peut pas dépasser 30 jours." });

  try {
    const passengerExists = await prisma.passenger.findUnique({ where: { id: passengerId } });
    if (!passengerExists)
      return res.status(404).json({ message: 'Passager introuvable' });

    const newRide = await prisma.trajet.create({
      data: {
        passenger: { connect: { id: passengerId } },
        depart: startAddress,
        destination: endAddress,
        startLat: parseFloat(startLat),
        startLng: parseFloat(startLng),
        startAddress,
        endLat: parseFloat(endLat),
        endLng: parseFloat(endLng),
        endAddress,
        dateDepart: departure,
        heureDepart: departure.toTimeString().slice(0, 5),
        placesDispo: 1,
        prix: 0,
        status: 'PENDING',
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

export const getPassengerRides = async (req, res) => {
  const passengerId = req.user.passengerId;
  if (!passengerId)
    return res.status(400).json({ message: "User not found in request" });

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
    console.error('Erreur getPassengerRides:', error);
    return res.status(500).json({ message: 'Erreur lors de la récupération des trajets', error: error.message });
  }
};

export const getRideById = async (req, res) => {
  const { id } = req.params;
  const passengerId = req.user?.passengerId;
  const driverId = req.user?.driverId;

  if (!passengerId && !driverId)
    return res.status(400).json({ success: false, message: "User not found in request" });

  try {
    const ride = await prisma.trajet.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true } },
        driver: { select: { id: true, nom: true, prenom: true, numTel: true , sexe: true} },
      },
    });

    if (!ride) return res.status(404).json({ success: false, message: "Trajet introuvable" });
    if (passengerId && ride.passagerId !== passengerId)
      return res.status(403).json({ success: false, message: "Accès refusé à ce trajet" });
    const canAccessPendingDriverRequest =
      driverId && ride.status === 'PENDING' && ride.driverId == null;
    if (driverId && ride.driverId !== driverId && !canAccessPendingDriverRequest)
      return res.status(403).json({ success: false, message: "Accès refusé à ce trajet" });

    return res.status(200).json({ success: true, data: ride });
  } catch (error) {
    console.error("Erreur getRideById:", error);
    return res.status(500).json({ success: false, message: "Erreur lors de la récupération du trajet", error: error.message });
  }
};

export const getDriverRequests = async (req, res) => {
  const driverId = req.user.driverId;
  if (!driverId)
    return res.status(400).json({ message: "Driver not found in request" });

  try {
    const driverExists = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driverExists) return res.status(404).json({ message: 'Conducteur introuvable' });

    const pendingRides = await prisma.trajet.findMany({
      where: { status: 'PENDING', driverId },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true, age: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ success: true, count: pendingRides.length, data: pendingRides });
  } catch (error) {
    console.error('Erreur getDriverRequests:', error);
    return res.status(500).json({ message: 'Erreur lors de la récupération des demandes', error: error.message });
  }
};

export const getDriverActiveRides = async (req, res) => {
  const driverId = req.user?.driverId;
  if (!driverId)
    return res.status(400).json({ success: false, message: "Driver not found in request" });

  try {
    const activeRides = await prisma.trajet.findMany({
      where: { driverId, status: { in: ['ACCEPTED', 'IN_PROGRESS'] } },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true, age: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.status(200).json({ success: true, count: activeRides.length, data: activeRides });
  } catch (error) {
    console.error('Erreur getDriverActiveRides:', error);
    return res.status(500).json({ success: false, message: 'Erreur lors de la récupération des trajets actifs', error: error.message });
  }
};

// ── acceptRide ────────────────────────────────────────────────────────────────
export const acceptRide = async (req, res) => {
  const driverId = req.user.driverId;
  if (!driverId)
    return res.status(400).json({ success: false, message: "Driver not found in request" });

  const { id } = req.params;

  try {
    const ride = await prisma.trajet.findUnique({ where: { id: parseInt(id) } });
    if (!ride) return res.status(404).json({ message: 'Demande de trajet introuvable' });
    if (ride.status !== 'PENDING')
      return res.status(400).json({ success: false, message: `Impossible d'accepter un trajet avec le status ${ride.status}` });

    // Annuler le timeout de ce driver — il a répondu explicitement
    clearDriverTimeout(parseInt(id), driverId);

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: {
        status: 'ACCEPTED',
        driver: { connect: { id: driverId } },
        updatedAt: new Date()
      },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true } },
        driver:    { select: { id: true, nom: true, prenom: true, numTel: true } },
      },
    });

    const io = getIO();
    const title   = '✅ Trajet confirmé';
    const message = `${updatedRide.driver.prenom} a accepté votre demande de trajet.`;

    io.to(`passenger_${updatedRide.passenger.id}`).emit('rideAccepted', {
      rideId:  updatedRide.id,
      status:  updatedRide.status,
      driver:  updatedRide.driver,
      title,
      message,
    });

    const otherDriverNotifs = await prisma.notification.findMany({
      where: {
        type: 'RIDE_REQUEST',
        data: { path: ['rideId'], equals: updatedRide.id },
        driverId: { not: driverId },
      },
      select: { driverId: true },
    });

    const otherDriverIds = [...new Set(otherDriverNotifs.map(n => n.driverId).filter(Boolean))];
    otherDriverIds.forEach(otherDriverId => {
      // Annuler aussi les timeouts des autres drivers notifiés
      clearDriverTimeout(parseInt(id), otherDriverId);
      io.to(`driver_${otherDriverId}`).emit('rideTaken', { rideId: updatedRide.id });
    });

    await createNotification({
      passengerId:   updatedRide.passagerId,
      recipientType: 'PASSENGER',
      type:          'RIDE_ACCEPTED',
      title,
      message,
      data: {
        rideId: updatedRide.id,
        driver: {
          prenom: updatedRide.driver.prenom,
          nom:    updatedRide.driver.nom,
        },
      },
    });

    return res.status(200).json({ success: true, message: 'Demande acceptée avec succès', data: updatedRide });

  } catch (error) {
    console.error('Erreur acceptRide:', error);
    return res.status(500).json({ message: "Erreur lors de l'acceptation de la demande", error: error.message });
  }
};

// ── rejectRide ────────────────────────────────────────────────────────────────
// MODIFIÉ : condition élargie avec timedOutDriverIds + clearTimeout
export const rejectRide = async (req, res) => {
  const driverId = req.user.driverId;
  if (!driverId)
    return res.status(400).json({ success: false, message: "Driver not found in request" });

  const { id } = req.params;

  try {
    const ride = await prisma.trajet.findUnique({ where: { id: parseInt(id) } });
    if (!ride) return res.status(404).json({ success: false, message: 'Demande de trajet introuvable' });
    if (ride.status !== 'PENDING')
      return res.status(400).json({ success: false, message: `Impossible de refuser un trajet avec le status ${ride.status}` });

    const wasNotified = await prisma.notification.findFirst({
      where: {
        driverId: driverId,
        type: 'RIDE_REQUEST',
        data: { path: ['rideId'], equals: parseInt(id) }
      }
    });

    if (!wasNotified)
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas autorisé à refuser ce trajet"
      });

    // Annuler le timeout — le driver a répondu explicitement
    clearDriverTimeout(parseInt(id), driverId);

    // Étape 1 : ajouter le driver aux refus
    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: {
        rejectedDriverIds: { push: driverId },
        updatedAt: new Date(),
      },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true } },
        driver:    { select: { id: true, nom: true, prenom: true, numTel: true } },
      },
    });

    // Étape 2 : condition élargie — rejected + timedOut >= notified
    const resolvedCount = updatedRide.rejectedDriverIds.length + updatedRide.timedOutDriverIds.length;
    const allResolved = resolvedCount >= updatedRide.notifiedDriversCount;

    // Étape 3 : mettre à jour le statut
    await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: { status: allResolved ? 'CANCELLED_BY_DRIVER' : 'PENDING' },
    });

    const io = getIO();
    const title   = '❌ Demande refusée';
    const message = `Votre demande de trajet a été refusée.`;

    io.to(`passenger_${updatedRide.passenger.id}`).emit('rideRejectedByDriver', {
      rideId:  updatedRide.id,
      status:  allResolved ? 'CANCELLED_BY_DRIVER' : 'PENDING',
      driver:  updatedRide.driver,
      title,
      message,
    });

    await createNotification({
      passengerId:   updatedRide.passagerId,
      recipientType: 'PASSENGER',
      type:          'RIDE_REJECTED',
      title,
      message,
      data: { rideId: updatedRide.id },
    });

    return res.status(200).json({ success: true, message: 'Demande refusée avec succès', data: updatedRide });

  } catch (error) {
    console.error('Erreur rejectRide:', error);
    return res.status(500).json({ message: 'Erreur lors du refus de la demande', error: error.message });
  }
};

// ── startRide ─────────────────────────────────────────────────────────────────
export const startRide = async (req, res) => {
  const { id } = req.params;

  try {
    const ride = await prisma.trajet.findUnique({ where: { id: parseInt(id) } });
    if (!ride) return res.status(404).json({ success: false, message: 'Trajet introuvable' });
    if (ride.status !== 'ACCEPTED')
      return res.status(400).json({ success: false, message: `Impossible de démarrer un trajet avec le status ${ride.status}. Le trajet doit être ACCEPTED.` });

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: { status: 'IN_PROGRESS', updatedAt: new Date() },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true } },
        driver:    { select: { id: true, nom: true, prenom: true, numTel: true } },
      },
    });

    const io = getIO();
    const title   = '🚗 Trajet démarré';
    const message = `Votre trajet avec ${updatedRide.driver.prenom} a démarré !`;

    io.to(`passenger_${updatedRide.passenger.id}`).emit('rideStarted', {
      rideId:  updatedRide.id,
      status:  updatedRide.status,
      driver:  updatedRide.driver,
      title,
      message,
    });

    await createNotification({
      passengerId:   updatedRide.passagerId,
      recipientType: 'PASSENGER',
      type:          'RIDE_STARTED',
      title,
      message,
      data: { rideId: updatedRide.id },
    });

    return res.status(200).json({ success: true, message: 'Trajet démarré avec succès', data: updatedRide });

  } catch (error) {
    console.error('Erreur startRide:', error);
    return res.status(500).json({ message: 'Erreur lors du démarrage du trajet', error: error.message });
  }
};

// ── completeRide ──────────────────────────────────────────────────────────────
export const completeRide = async (req, res) => {
  const { id } = req.params;

  try {
    const ride = await prisma.trajet.findUnique({ where: { id: parseInt(id) } });
    if (!ride) return res.status(404).json({ success: false, message: 'Trajet introuvable' });
    if (ride.status !== 'IN_PROGRESS')
      return res.status(400).json({ success: false, message: `Impossible de terminer un trajet avec le status ${ride.status}. Le trajet doit être IN_PROGRESS.` });

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: { status: 'COMPLETED', updatedAt: new Date(), completedAt: new Date() },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true } },
        driver:    { select: { id: true, nom: true, prenom: true } },
      },
    });

    const io = getIO();
    const title   = '🏁 Trajet terminé';
    const message = `Votre trajet est terminé. Donnez votre avis sur ${updatedRide.driver.prenom} !`;

    io.to(`passenger_${updatedRide.passenger.id}`).emit('rideCompleted', {
      rideId:  updatedRide.id,
      status:  updatedRide.status,
      title,
      message,
    });

    await createNotification({
      passengerId:   updatedRide.passagerId,
      recipientType: 'PASSENGER',
      type:          'RIDE_COMPLETED',
      title,
      message,
      data: { rideId: updatedRide.id },
    });

    return res.status(200).json({ success: true, message: 'Trajet terminé avec succès', data: updatedRide });

  } catch (error) {
    console.error('Erreur completeRide:', error);
    return res.status(500).json({ message: 'Erreur lors de la complétion du trajet', error: error.message });
  }
};

// ── cancelRide ────────────────────────────────────────────────────────────────
export const cancelRide = async (req, res) => {
  const passengerId = req.user.passengerId;
  if (!passengerId)
    return res.status(400).json({ success: false, message: "User not found in request" });

  const { id } = req.params;

  try {
    const ride = await prisma.trajet.findUnique({ where: { id: parseInt(id) } });
    if (!ride) return res.status(404).json({ success: false, message: 'Trajet introuvable' });
    if (ride.passagerId !== passengerId)
      return res.status(403).json({ success: false, message: 'Vous ne pouvez annuler que vos propres trajets' });
    if (ride.status === 'COMPLETED' || ride.status.startsWith('CANCELLED'))
      return res.status(400).json({ success: false, message: `Impossible d'annuler un trajet avec le status ${ride.status}` });

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: { status: 'CANCELLED_BY_PASSENGER', updatedAt: new Date() },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true } },
        driver:    { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (updatedRide.driver && updatedRide.driverId) {
      const io = getIO();
      const title   = '❌ Trajet annulé';
      const message = `${updatedRide.passenger.prenom} a annulé le trajet.`;

      io.to(`driver_${updatedRide.driverId}`).emit('rideCancelledByPassenger', {
        rideId:    updatedRide.id,
        status:    updatedRide.status,
        passenger: updatedRide.passenger,
        title,
        message,
      });

      await createNotification({
        driverId:      updatedRide.driverId,
        recipientType: 'DRIVER',
        type:          'RIDE_CANCELLED',
        title,
        message,
        data: {
          rideId:    updatedRide.id,
          passenger: {
            prenom: updatedRide.passenger.prenom,
            nom:    updatedRide.passenger.nom,
          },
        },
      });
    }

    return res.status(200).json({ success: true, message: 'Trajet annulé avec succès', data: updatedRide });

  } catch (error) {
    console.error('Erreur cancelRide:', error);
    return res.status(500).json({ message: "Erreur lors de l'annulation du trajet", error: error.message });
  }
};

export const getPassengerRideActivity = async (req, res) => {
  const passengerId = parseAndValidateId(req.params.id);
  if (!passengerId)
    return res.status(400).json({ success: false, message: "ID passager invalide" });
  if (req.user?.passengerId && req.user.passengerId !== passengerId)
    return res.status(403).json({ success: false, message: "Acces refuse" });

  try {
    const rides = await prisma.trajet.findMany({
      where: { passagerId: passengerId },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true } },
        driver:    { select: { id: true, nom: true, prenom: true, numTel: true, avgRating: true , sexe: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const activity = rides.map((ride) => ({
      rideId: ride.id, status: ride.status,
      activityAt: ride.updatedAt, createdAt: ride.createdAt,
      updatedAt: ride.updatedAt, completedAt: ride.completedAt,
      prix: ride.prix, depart: ride.depart, destination: ride.destination,
      startAddress: ride.startAddress, endAddress: ride.endAddress,
      dateDepart: ride.dateDepart, heureDepart: ride.heureDepart,
      passenger: ride.passenger || null, driver: ride.driver || null,
    }));

    return res.status(200).json({ success: true, count: activity.length, data: activity });
  } catch (error) {
    console.error('Erreur getPassengerRideActivity:', error);
    return res.status(500).json({ success: false, message: "Erreur lors de la recuperation de l'activite passager", error: error.message });
  }
};

export const getDriverRideActivity = async (req, res) => {
  const driverId = parseAndValidateId(req.params.id);
  if (!driverId)
    return res.status(400).json({ success: false, message: "ID conducteur invalide" });
  if (req.user?.driverId && req.user.driverId !== driverId)
    return res.status(403).json({ success: false, message: "Acces refuse" });

  try {
    const rides = await prisma.trajet.findMany({
      where: {
        OR: [
          { driverId: driverId },
          {
            status: 'PENDING',
            driverId: null,
            NOT: {
              // MODIFIÉ : exclure aussi les timedOut
              OR: [
                { rejectedDriverIds: { has: driverId } },
                { timedOutDriverIds: { has: driverId } },
              ]
            }
          }
        ]
      },
      include: {
        driver:    { select: { id: true, nom: true, prenom: true, numTel: true, sexe: true } },
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true, age: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const activity = rides.map((ride) => ({
      rideId: ride.id, status: ride.status,
      activityAt: ride.updatedAt, createdAt: ride.createdAt,
      updatedAt: ride.updatedAt, completedAt: ride.completedAt,
      prix: ride.prix, depart: ride.depart, destination: ride.destination,
      startAddress: ride.startAddress, endAddress: ride.endAddress,
      dateDepart: ride.dateDepart, heureDepart: ride.heureDepart,
      driver: ride.driver || null, passenger: ride.passenger || null,
    }));

    return res.status(200).json({ success: true, count: activity.length, data: activity });
  } catch (error) {
    console.error('Erreur getDriverRideActivity:', error);
    return res.status(500).json({ success: false, message: "Erreur lors de la recuperation de l'activite conducteur", error: error.message });
  }
};