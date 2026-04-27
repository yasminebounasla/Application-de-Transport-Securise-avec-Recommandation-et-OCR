import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket/socket.js';
import { createNotification } from './NotificationController.js';
import { calculateRoute }  from '../services/geoService.js';
import { calculatePrice }  from '../utils/priceCalculator.js';
import { calculateDistance } from '../utils/geo.js';

const prisma = new PrismaClient();

const parseAndValidateId = (rawId) => {
  const id = Number.parseInt(rawId, 10);
  return Number.isNaN(id) ? null : id;
};

const pendingTimeouts = new Map();
const SIX_HOURS = 6 * 60 * 60 * 1000;

const evaluateTrajet = async (trajetId) => {
  const ride = await prisma.trajet.findUnique({ where: { id: trajetId } });
  console.log('🔍 evaluateTrajet:', trajetId, 'status:', ride?.status);
  if (!ride || ride.status !== 'PENDING') return;

  const resolvedCount = ride.rejectedDriverIds.length + ride.timedOutDriverIds.length;
  console.log('📊 resolvedCount:', resolvedCount, '/ notifiedDriversCount:', ride.notifiedDriversCount);

  if (resolvedCount < ride.notifiedDriversCount) return;

  const allRecommended = Array.isArray(ride.recommendedDrivers) ? ride.recommendedDrivers : [];
  const sentSet        = new Set(ride.sentDrivers || []);

  const backupDrivers = allRecommended
    .filter(d => !sentSet.has(d.id))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5);

  const io = getIO();

  if (backupDrivers.length > 0 && ride.fallbackStep === 0) {

    await prisma.trajet.update({
      where: { id: trajetId },
      data: { fallbackStep: 1 },
    });

    const rejCount      = ride.rejectedDriverIds.length;
    const timedOutCount = ride.timedOutDriverIds.length;

    const message = rejCount > 0 && timedOutCount === 0
      ? "Les conducteurs ont refusé votre demande. Voulez-vous contacter d'autres conducteurs ?"
      : rejCount === 0 && timedOutCount > 0
        ? "Les conducteurs contactés n'ont pas répondu. Voici d'autres conducteurs recommandés."
        : "Certains conducteurs ont refusé et d'autres n'ont pas répondu. Voulez-vous contacter d'autres conducteurs ?";

    const reason = rejCount > 0 && timedOutCount === 0 ? 'REJECTED'
      : rejCount === 0 && timedOutCount > 0 ? 'TIMEOUT'
      : 'MIXED';

    // ── AJOUT 1 : notif + socket refus pour que le passager reçoive la notif ──
    await createNotification({
      passengerId:   ride.passagerId,
      recipientType: 'PASSENGER',
      type:          'RIDE_REJECTED',
      title:         '❌ Demande refusée',
      message:       'Les conducteurs ont refusé votre demande.',
      data:          { rideId: ride.id },
    });

    io.to(`passenger_${ride.passagerId}`).emit('rideRejectedByDriver', {
      rideId:  ride.id,
      title:   '❌ Demande refusée',
      message: 'Les conducteurs ont refusé votre demande.',
    });
    // ── FIN AJOUT 1 ────────────────────────────────────────────────────────────

    io.to(`passenger_${ride.passagerId}`).emit('fallbackRequired', {
      rideId:        ride.id,
      type:          'BACKUP_AVAILABLE',
      backupDrivers: backupDrivers,
      message,
      reason,
    });

    return;
  }

  // CAS 3 : Aucune option disponible → cancel définitif
  await prisma.trajet.update({
    where: { id: trajetId },
    data:  { status: 'CANCELLED_BY_DRIVER' },
  });

  io.to(`passenger_${ride.passagerId}`).emit('rideRejectedByDriver', {
    rideId:  ride.id,
    status:  'CANCELLED_BY_DRIVER',
    title:   '❌ Demande refusée',
    message: 'Votre demande de trajet a été refusée par tous les conducteurs.',
  });

  await createNotification({
    passengerId:   ride.passagerId,
    recipientType: 'PASSENGER',
    type:          'RIDE_REJECTED',
    title:         '❌ Demande refusée',
    message:       'Votre demande de trajet a été refusée par tous les conducteurs.',
    data:          { rideId: ride.id },
  });
};

export const scheduleDriverTimeout = (trajetId, driverId, dateDepart) => {
  const hoursUntil = (new Date(dateDepart) - Date.now()) / 3600000;
  const timeout = hoursUntil < 1   ? 5  * 60 * 1000
              : hoursUntil < 3   ? 15 * 60 * 1000
              : hoursUntil < 24  ? 30 * 60 * 1000
              :                    2  * 60 * 60 * 1000;
  const key = `${trajetId}_${driverId}`;

  const timeoutId = setTimeout(async () => {
    pendingTimeouts.delete(key);
    const ride = await prisma.trajet.findUnique({ where: { id: trajetId } });
    if (!ride || ride.status !== 'PENDING') return;
    if (ride.rejectedDriverIds.includes(driverId)) return;

    console.log(`⏱️ Timeout driver ${driverId} pour trajet ${trajetId}`);
    await prisma.trajet.update({
      where: { id: trajetId },
      data:  { timedOutDriverIds: { push: driverId }, updatedAt: new Date() },
    });
    await evaluateTrajet(trajetId);
  }, timeout);

  pendingTimeouts.set(key, timeoutId);
};

export const clearDriverTimeout = (trajetId, driverId) => {
  const key = `${trajetId}_${driverId}`;
  const timeoutId = pendingTimeouts.get(key);
  if (timeoutId) {
    clearTimeout(timeoutId);
    pendingTimeouts.delete(key);
  }
};

export { evaluateTrajet };

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

    const routeResult = await calculateRoute(
      { latitude: parseFloat(startLat), longitude: parseFloat(startLng) },
      { latitude: parseFloat(endLat),   longitude: parseFloat(endLng) }
    );

    if (!routeResult.success) {
      return res.status(503).json({
        message: "Impossible de calculer l'itinéraire. Veuillez réessayer."
      });
    }

    const { price: prix } = calculatePrice(
      parseFloat(routeResult.distanceKm),
      routeResult.durationMin
    );

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
        prix,
        distanceKm:  parseFloat(routeResult.distanceKm),
        durationMin: routeResult.durationMin,
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
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true, photoUrl: true } },
        driver: { select: { id: true, nom: true, prenom: true, numTel: true, sexe: true } },
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
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true, age: true, photoUrl: true } },
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
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true, age: true, photoUrl: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.status(200).json({ success: true, count: activeRides.length, data: activeRides });
  } catch (error) {
    console.error('Erreur getDriverActiveRides:', error);
    return res.status(500).json({ success: false, message: 'Erreur lors de la récupération des trajets actifs', error: error.message });
  }
};

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

    clearDriverTimeout(parseInt(id), driverId);

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: {
        status: 'ACCEPTED',
        driver: { connect: { id: driverId } },
        updatedAt: new Date()
      },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true, photoUrl: true } },
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

    const rideWithSent = await prisma.trajet.findUnique({
      where: { id: parseInt(id) },
      select: { sentDrivers: true },
    });

    console.log('🔍 sentDrivers from DB:', rideWithSent.sentDrivers);
    console.log('🔍 driverId who accepted:', driverId, typeof driverId);

    const otherDriverIds = (rideWithSent.sentDrivers || []).filter(d => Number(d) !== Number(driverId));

    console.log('🔍 otherDriverIds to notify:', otherDriverIds);

    otherDriverIds.forEach(async (otherDriverId) => {
      clearDriverTimeout(parseInt(id), otherDriverId);
      io.to(`driver_${otherDriverId}`).emit('rideTaken', { rideId: updatedRide.id });

      await createNotification({
        driverId:      otherDriverId,
        recipientType: 'DRIVER',
        type:          'RIDE_TAKEN',
        title:         '🚫 Trajet non disponible',
        message:       'Ce trajet a déjà été pris par un autre conducteur.',
        data:          { rideId: updatedRide.id },
      });
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

    clearDriverTimeout(parseInt(id), driverId);

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: {
        rejectedDriverIds: { push: driverId },
        updatedAt: new Date(),
      },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, photoUrl: true } },
        driver:    { select: { id: true, nom: true, prenom: true, numTel: true } },
      },
    });

    await evaluateTrajet(parseInt(id));

    return res.status(200).json({ success: true, message: 'Demande refusée avec succès', data: updatedRide });

  } catch (error) {
    console.error('Erreur rejectRide:', error);
    return res.status(500).json({ message: 'Erreur lors du refus de la demande', error: error.message });
  }
};

export const startRide = async (req, res) => {
  const { id } = req.params;
  const driverId = req.user?.driverId;
  const { location } = req.body || {};

  try {
    if (!driverId) {
      return res.status(403).json({ success: false, message: 'Accès conducteur requis' });
    }

    const ride = await prisma.trajet.findUnique({ where: { id: parseInt(id) } });
    if (!ride) return res.status(404).json({ success: false, message: 'Trajet introuvable' });
    if (ride.status !== 'ACCEPTED')
      return res.status(400).json({ success: false, message: `Impossible de démarrer un trajet avec le status ${ride.status}. Le trajet doit être ACCEPTED.` });

    if (!ride.driverId || Number(ride.driverId) !== Number(driverId)) {
      return res.status(403).json({ success: false, message: "Vous n'êtes pas autorisé à démarrer ce trajet" });
    }

    if (ride.dateDepart && typeof ride.heureDepart === 'string' && ride.heureDepart.includes(':')) {
      const [hhRaw, mmRaw] = ride.heureDepart.split(':');
      const hh = Number.parseInt(hhRaw, 10);
      const mm = Number.parseInt(mmRaw, 10);
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        const scheduled = new Date(ride.dateDepart);
        scheduled.setHours(hh, mm, 0, 0);
        const earlyWindowMs = 10 * 60 * 1000;
        if (Date.now() < scheduled.getTime() - earlyWindowMs) {
          return res.status(400).json({
            success: false,
            message: `Vous pouvez démarrer au plus tôt 10 minutes avant l'heure de départ.`,
          });
        }
      }
    }

    const lat = Number(location?.latitude);
    const lng = Number(location?.longitude);
    const accuracy = Number(location?.accuracy);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, message: 'Localisation conducteur requise' });
    }

    const pickupLat = Number(ride.startLat);
    const pickupLng = Number(ride.startLng);
    if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
      const km = calculateDistance(lat, lng, pickupLat, pickupLng);
      const meters = km * 1000;
      const baseMeters = 80;
      const maxMeters = 150;
      const allowedMeters = Number.isFinite(accuracy)
        ? Math.min(maxMeters, Math.max(baseMeters, Math.round(baseMeters + accuracy)))
        : baseMeters;
      if (meters > allowedMeters) {
        return res.status(400).json({
          success: false,
          message: `Rapprochez-vous du passager pour démarrer (${Math.round(meters)} m).`,
        });
      }
    }

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: { status: 'IN_PROGRESS', updatedAt: new Date() },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true, photoUrl: true } },
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

export const completeRide = async (req, res) => {
  const { id } = req.params;
  const driverId = req.user?.driverId;
  const { location } = req.body || {};

  try {
    if (!driverId) {
      return res.status(403).json({ success: false, message: 'Accès conducteur requis' });
    }

    const ride = await prisma.trajet.findUnique({ where: { id: parseInt(id) } });
    if (!ride) return res.status(404).json({ success: false, message: 'Trajet introuvable' });
    if (ride.status !== 'IN_PROGRESS')
      return res.status(400).json({ success: false, message: `Impossible de terminer un trajet avec le status ${ride.status}. Le trajet doit être IN_PROGRESS.` });

    if (!ride.driverId || Number(ride.driverId) !== Number(driverId)) {
      return res.status(403).json({ success: false, message: "Vous n'êtes pas autorisé à terminer ce trajet" });
    }

    const lat = Number(location?.latitude);
    const lng = Number(location?.longitude);
    const accuracy = Number(location?.accuracy);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, message: 'Localisation conducteur requise' });
    }

    const destLat = Number(ride.endLat);
    const destLng = Number(ride.endLng);
    if (Number.isFinite(destLat) && Number.isFinite(destLng)) {
      const km = calculateDistance(lat, lng, destLat, destLng);
      const meters = km * 1000;
      const baseMeters = 120;
      const maxMeters = 200;
      const allowedMeters = Number.isFinite(accuracy)
        ? Math.min(maxMeters, Math.max(baseMeters, Math.round(baseMeters + accuracy)))
        : baseMeters;
      if (meters > allowedMeters) {
        return res.status(400).json({
          success: false,
          message: `Rapprochez-vous de la destination pour terminer (${Math.round(meters)} m).`,
        });
      }
    }

    const updatedRide = await prisma.trajet.update({
      where: { id: parseInt(id) },
      data: { status: 'COMPLETED', updatedAt: new Date(), completedAt: new Date() },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, photoUrl: true } },
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
        passenger: { select: { id: true, nom: true, prenom: true, photoUrl: true } },
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
            photoUrl: updatedRide.passenger.photoUrl,
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
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true, photoUrl: true } },
        driver:    { select: { id: true, nom: true, prenom: true, numTel: true, avgRating: true, sexe: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const activity = rides.map((ride) => ({
      rideId: ride.id, status: ride.status,
      activityAt: ride.updatedAt, createdAt: ride.createdAt,
      updatedAt: ride.updatedAt, completedAt: ride.completedAt,
      prix: ride.prix, depart: ride.depart, destination: ride.destination,
      distanceKm:  ride.distanceKm  || null,
      durationMin: ride.durationMin || null,
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
    const mapRide = (ride) => ({
      rideId: ride.id, status: ride.status,
      activityAt: ride.updatedAt, createdAt: ride.createdAt,
      updatedAt: ride.updatedAt, completedAt: ride.completedAt,
      prix: ride.prix, depart: ride.depart, destination: ride.destination,
      distanceKm:  ride.distanceKm  || null,
      durationMin: ride.durationMin || null,
      startAddress: ride.startAddress, endAddress: ride.endAddress,
      dateDepart: ride.dateDepart, heureDepart: ride.heureDepart,
      driver: ride.driver || null, passenger: ride.passenger || null,
      rejectedDriverIds: ride.rejectedDriverIds || [],  // ── AJOUT 2 : pour le frontend cancelled-by-you
    });

    const [rides, rejectedRides] = await Promise.all([
      prisma.trajet.findMany({
        where: {
          OR: [
            { driverId: driverId },
            {
              status: 'PENDING',
              driverId: null,
              sentDrivers: { has: driverId },
              NOT: {
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
          passenger: { select: { id: true, nom: true, prenom: true, numTel: true, age: true, photoUrl: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.trajet.findMany({
        where: {
          sentDrivers: { has: driverId },
          rejectedDriverIds: { has: driverId },
        },
        include: {
          driver:    { select: { id: true, nom: true, prenom: true, numTel: true, sexe: true } },
          passenger: { select: { id: true, nom: true, prenom: true, numTel: true, age: true, photoUrl: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const activity = [...rides.map(mapRide), ...rejectedRides.map(mapRide)];

    return res.status(200).json({ success: true, count: activity.length, data: activity });
  } catch (error) {
    console.error('Erreur getDriverRideActivity:', error);
    return res.status(500).json({ success: false, message: "Erreur lors de la recuperation de l'activite conducteur", error: error.message });
  }
};
