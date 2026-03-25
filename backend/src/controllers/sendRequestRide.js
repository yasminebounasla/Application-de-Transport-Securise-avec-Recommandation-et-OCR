import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket/socket.js';
import { createNotification } from './NotificationController.js';

const prisma = new PrismaClient();

// ── POST /api/rides/send-requests ─────────────────────────────────────────────
// Envoie une demande de trajet à plusieurs drivers via Socket.IO + BD
export const sendRideRequests = async (req, res) => {
  const passengerId = req.user.passengerId;
  if (!passengerId)
    return res.status(400).json({ success: false, message: "Passager non identifié" });

  const { rideId, driverIds, preferences } = req.body;

  if (!rideId || !Array.isArray(driverIds) || driverIds.length === 0)
    return res.status(400).json({ success: false, message: "rideId et driverIds[] sont requis" });

  try {
    // Vérifier que le trajet appartient bien à ce passager
    const ride = await prisma.trajet.findUnique({
      where: { id: rideId },
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

    // Vérifier que les drivers existent
    const drivers = await prisma.driver.findMany({
      where: { id: { in: driverIds } },
      select: { id: true, nom: true, prenom: true },
    });

    if (drivers.length === 0)
      return res.status(404).json({ success: false, message: "Aucun conducteur trouvé" });

    const io = getIO();
    let notifiedCount = 0;

    // Mettre à jour le trajet pour lui assigner le premier driver ciblé (ou garder PENDING)
    // et notifier chaque driver sélectionné
    for (const driver of drivers) {
      // Émettre via Socket.IO au driver
      io.to(`driver_${driver.id}`).emit('rideRequest', {
        rideId:    ride.id,
        passenger: ride.passenger,
        depart:    ride.startAddress || ride.depart,
        destination: ride.endAddress || ride.destination,
        dateDepart:  ride.dateDepart,
        preferences: preferences || {},
      });

      // Persister la notification en BD
      await createNotification({
        driverId:      driver.id,
        recipientType: 'DRIVER',
        type:          'RIDE_REQUEST',
        title:         '🚗 Nouvelle demande de trajet',
        message:       `${ride.passenger.prenom} ${ride.passenger.nom} recherche un conducteur.`,
        data: {
          rideId:    ride.id,
          passenger: {
            prenom: ride.passenger.prenom,
            nom:    ride.passenger.nom,
          },
          depart:      ride.startAddress || ride.depart,
          destination: ride.endAddress   || ride.destination,
        },
      });

      // Associer le trajet au driver (driverId) pour qu'il apparaisse dans ses requests
      await prisma.trajet.update({
        where: { id: ride.id },
        data:  { driverId: driver.id },
      });

      notifiedCount++;
    }

    return res.status(200).json({
      success: true,
      message: `Demande envoyée à ${notifiedCount} conducteur(s)`,
      driversNotified: notifiedCount,
    });

  } catch (error) {
    console.error('Erreur sendRideRequests:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};