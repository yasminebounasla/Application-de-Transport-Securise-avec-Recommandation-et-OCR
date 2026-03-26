import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket/socket.js';
import { createNotification } from './NotificationController.js';
import { scheduleDriverTimeout } from './rideController.js'; 

const prisma = new PrismaClient();

// ── POST /api/rides/send-requests ─────────────────────────────────────────────
export const sendRideRequests = async (req, res) => {
  const passengerId = req.user.passengerId;
  if (!passengerId)
    return res.status(400).json({ success: false, message: "Passager non identifié" });

  // [FIX] On récupère chosenDriverScores depuis le body.
  // Le frontend envoie driver._scores du driver choisi dans la liste de recommandations.
  // Exemple : { lightfm: 0.8, pref: 0.6, dist: 0.4, work: 1.0, rating: 0.75 }
  // Si le trajet ne vient pas du système ML, ce champ sera absent → null, c'est normal.
  const { rideId, driverIds, preferences, chosenDriverScores } = req.body;

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

    // [FIX] Persistance des scores ML dans le trajet.
    // On sauvegarde ici parce que c'est le moment où le passager a choisi son
    // driver depuis la liste de recommandations — les scores sont donc disponibles.
    // Plus tard, submitFeedback lira mlScores depuis la DB pour envoyer le feedback
    // à FastAPI sans avoir à garder quoi que ce soit en mémoire.
    // mlScores est Json? dans le schéma → aucun impact si absent.
    if (chosenDriverScores && typeof chosenDriverScores === 'object') {
      await prisma.trajet.update({
        where: { id: rideId },
        data:  { mlScores: chosenDriverScores },
      });
    }

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

      await prisma.trajet.update({
        where: { id: ride.id },
        data:  { notifiedDriversCount: drivers.length },
      });

      // ── AJOUT : démarrer le chronomètre pour ce driver ──────────────────────
      // Si le driver n'accepte pas / refuse avant expiration → timedOutDriverIds
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