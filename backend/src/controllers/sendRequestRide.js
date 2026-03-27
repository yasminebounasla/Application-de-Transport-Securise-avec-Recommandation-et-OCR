import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket/socket.js';
import { createNotification } from './NotificationController.js';
import { scheduleDriverTimeout } from './rideController.js';

const prisma = new PrismaClient();

// ── POST /api/ridesDem/send-requests ─────────────────────────────────────────
// ✅ MODIFIÉ : stocke les 10 drivers recommandés, affiche les 5 premiers
//             les 5 restants sont gardés en fallback dans recommendedDrivers
export const sendRideRequests = async (req, res) => {
  const passengerId = req.user.passengerId;
  if (!passengerId)
    return res.status(400).json({ success: false, message: "Passager non identifié" });

  const { rideId, driverIds, preferences, chosenDriverScores, allRecommendedDrivers } = req.body;
  // allRecommendedDrivers = tableau complet des 10 drivers retournés par FastAPI
  // driverIds             = les IDs sélectionnés par le passager (parmi les 5 premiers)

  if (!rideId || !Array.isArray(driverIds) || driverIds.length === 0)
    return res.status(400).json({ success: false, message: "rideId et driverIds[] sont requis" });

  try {
    const ride = await prisma.trajet.findUnique({
      where:   { id: rideId },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true } },
      },
    });

    if (!ride)
      return res.status(404).json({ success: false, message: "Trajet introuvable" });
    if (ride.passagerId !== passengerId)
      return res.status(403).json({ success: false, message: "Ce trajet ne vous appartient pas" });
    if (ride.status !== 'PENDING')
      return res.status(400).json({ success: false, message: `Impossible d'envoyer des demandes pour un trajet avec le status ${ride.status}` });

    const drivers = await prisma.driver.findMany({
      where:  { id: { in: driverIds } },
      select: { id: true, nom: true, prenom: true },
    });

    if (drivers.length === 0)
      return res.status(404).json({ success: false, message: "Aucun conducteur trouvé" });

    // ── Préparer les données à stocker ────────────────────────────────────────
    const updateData = {
      notifiedDriversCount: drivers.length,
      // Tracker les drivers déjà contactés (évite doublons fallback)
      sentDrivers: { set: driverIds },
      fallbackStep: 0,
    };

    // ✅ Stocker les 10 drivers recommandés avec leur rang
    // Format: [{id: 1, rank: 1}, {id: 2, rank: 2}, ..., {id: 10, rank: 10}]
    if (Array.isArray(allRecommendedDrivers) && allRecommendedDrivers.length > 0) {
      updateData.recommendedDrivers = allRecommendedDrivers.map((d, i) => ({
        id:   d.id,
        rank: i + 1,
        // Conserver quelques infos utiles pour le fallback modal
        nom:         d.nom,
        prenom:      d.prenom,
        avgRating:   d.avgRating,
        distance_km: d.distance_km,
        sexe:        d.sexe,
        work_match:  d.work_match,
      }));
    }

    // Persister les scores ML si disponibles
    if (chosenDriverScores && typeof chosenDriverScores === 'object') {
      updateData.mlScores = chosenDriverScores;
    }

    await prisma.trajet.update({
      where: { id: rideId },
      data:  updateData,
    });

    // ── Notifier les drivers sélectionnés ─────────────────────────────────────
    const io = getIO();
    let notifiedCount = 0;

    for (const driver of drivers) {
      io.to(`driver_${driver.id}`).emit('rideRequest', {
        rideId:      ride.id,
        passenger:   ride.passenger,
        depart:      ride.startAddress || ride.depart,
        destination: ride.endAddress   || ride.destination,
        dateDepart:  ride.dateDepart,
        preferences: preferences || {},
      });

      await createNotification({
        driverId:      driver.id,
        recipientType: 'DRIVER',
        type:          'RIDE_REQUEST',
        title:         '🚗 Nouvelle demande de trajet',
        message:       `${ride.passenger.prenom} ${ride.passenger.nom} recherche un conducteur.`,
        data: {
          rideId:      ride.id,
          passenger:   { prenom: ride.passenger.prenom, nom: ride.passenger.nom },
          depart:      ride.startAddress || ride.depart,
          destination: ride.endAddress   || ride.destination,
        },
      });

      scheduleDriverTimeout(ride.id, driver.id, ride.dateDepart);
      notifiedCount++;
    }

    return res.status(200).json({
      success:         true,
      message:         `Demande envoyée à ${notifiedCount} conducteur(s)`,
      driversNotified: notifiedCount,
    });

  } catch (error) {
    console.error('Erreur sendRideRequests:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ── POST /api/ridesDem/send-fallback ─────────────────────────────────────────
// ✅ NOUVEAU : le passager choisit depuis le modal fallback
//             soit les 5 restants du batch initial, soit 5 nouveaux drivers
export const sendFallbackRequests = async (req, res) => {
  const passengerId = req.user.passengerId;
  if (!passengerId)
    return res.status(400).json({ success: false, message: "Passager non identifié" });

  const { rideId, driverIds } = req.body;

  if (!rideId || !Array.isArray(driverIds) || driverIds.length === 0)
    return res.status(400).json({ success: false, message: "rideId et driverIds[] sont requis" });

  try {
    const ride = await prisma.trajet.findUnique({
      where:   { id: rideId },
      include: {
        passenger: { select: { id: true, nom: true, prenom: true, numTel: true } },
      },
    });

    if (!ride)
      return res.status(404).json({ success: false, message: "Trajet introuvable" });
    if (ride.passagerId !== passengerId)
      return res.status(403).json({ success: false, message: "Ce trajet ne vous appartient pas" });
    if (ride.status !== 'PENDING')
      return res.status(400).json({ success: false, message: `Trajet non disponible (${ride.status})` });

    const drivers = await prisma.driver.findMany({
      where:  { id: { in: driverIds } },
      select: { id: true, nom: true, prenom: true },
    });

    if (drivers.length === 0)
      return res.status(404).json({ success: false, message: "Aucun conducteur trouvé" });

    // ── Ajouter les nouveaux drivers dans sentDrivers + reset les compteurs ───
    const newSentDrivers = [...new Set([...ride.sentDrivers, ...driverIds])];

    await prisma.trajet.update({
      where: { id: rideId },
      data: {
        // Remettre à PENDING proprement
        status:               'PENDING',
        // Ajouter ces drivers au suivi
        sentDrivers:          { set: newSentDrivers },
        // Incrementer fallbackStep
        fallbackStep:         { increment: 1 },
        // Reset les compteurs pour ce nouveau batch
        notifiedDriversCount: drivers.length,
        rejectedDriverIds:    { set: [] },
        timedOutDriverIds:    { set: [] },
        updatedAt:            new Date(),
      },
    });

    const io = getIO();
    let notifiedCount = 0;

    for (const driver of drivers) {
      io.to(`driver_${driver.id}`).emit('rideRequest', {
        rideId:      ride.id,
        passenger:   ride.passenger,
        depart:      ride.startAddress || ride.depart,
        destination: ride.endAddress   || ride.destination,
        dateDepart:  ride.dateDepart,
        preferences: {},
      });

      await createNotification({
        driverId:      driver.id,
        recipientType: 'DRIVER',
        type:          'RIDE_REQUEST',
        title:         '🚗 Nouvelle demande de trajet',
        message:       `${ride.passenger.prenom} ${ride.passenger.nom} recherche un conducteur.`,
        data: {
          rideId:      ride.id,
          passenger:   { prenom: ride.passenger.prenom, nom: ride.passenger.nom },
          depart:      ride.startAddress || ride.depart,
          destination: ride.endAddress   || ride.destination,
        },
      });

      scheduleDriverTimeout(ride.id, driver.id, ride.dateDepart);
      notifiedCount++;
    }

    return res.status(200).json({
      success:         true,
      message:         `Demande fallback envoyée à ${notifiedCount} conducteur(s)`,
      driversNotified: notifiedCount,
    });

  } catch (error) {
    console.error('Erreur sendFallbackRequests:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};