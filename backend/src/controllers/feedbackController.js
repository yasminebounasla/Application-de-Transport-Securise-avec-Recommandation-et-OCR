import { prisma } from "../config/prisma.js";
import { getIO } from "../socket/socket.js";
import { createNotification } from "./NotificationController.js";

// [FIX] Import de sendFeedback depuis mlService.
// Remplace l'ancienne fonction notifyFastAPIFeedback qui utilisait le format
// { rideId, driverId, rating } — incompatible avec recommender.py qui attend
// { rating, scores }. La nouvelle approche lit mlScores depuis la DB.
import { sendFeedback } from "../services/recommendationService.js";

export const submitFeedback = async (req, res) => {
  const { trajetId, rating, comment } = req.body;
  try {
    const trajet = await prisma.trajet.findUnique({
      where:   { id: trajetId },
      include: { driver: true, passenger: true },
    });

    if (!trajet)
      return res.status(404).json({ message: "Trajet not found." });
    if (trajet.status !== "COMPLETED")
      return res.status(400).json({ message: "Feedback can only be submitted for completed trajets." });

    const existingFeedback = await prisma.evaluation.findUnique({ where: { trajetId } });
    if (existingFeedback)
      return res.status(400).json({ message: "Vous avez déjà soumis un feedback pour ce trajet." });

    const feedback = await prisma.evaluation.create({
      data: { trajetId, rating, comment },
    });

    const driver = trajet.driver;
    if (driver) {
      const newRatingsCount = (driver.ratingsCount || 0) + 1;
      const newAvgRating    = ((driver.avgRating || 0) * (driver.ratingsCount || 0) + rating) / newRatingsCount;

      await prisma.driver.update({
        where: { id: driver.id },
        data:  { ratingsCount: newRatingsCount, avgRating: newAvgRating },
      });

      const io            = getIO();
      const passengerName = `${trajet.passenger.prenom} ${trajet.passenger.nom}`;
      const title         = '⭐ Nouvel avis reçu';
      const message       = `${passengerName} vous a donné une note de ${rating}/5.`;

      io.to(`driver_${trajet.driverId}`).emit('newFeedback', {
        trajetId: trajet.id, rating, comment, passengerName, title, message,
      });

      await createNotification({
        driverId:      trajet.driverId,
        recipientType: 'DRIVER',
        type:          'NEW_FEEDBACK',
        title,
        message,
        data: {
          rideId:    trajet.id,
          rating,
          passenger: { prenom: trajet.passenger.prenom, nom: trajet.passenger.nom },
        },
      });

      // [FIX] Envoi du feedback au système ML via mlService.sendFeedback().
      // On lit mlScores depuis la DB (sauvegardé dans sendRideRequests).
      // Fire-and-forget : si FastAPI est down, ça ne plante pas la réponse HTTP.
      // Si mlScores est null (trajet sans recommandation ML), on skip silencieusement.
      if (trajet.mlScores) {
        sendFeedback(rating, trajet.mlScores).catch((err) =>
          console.warn(`[ML] sendFeedback échoué pour trajetId=${trajet.id} (non bloquant):`, err.message)
        );
      } else {
        console.log(`[ML] mlScores absent pour trajetId=${trajet.id} — feedback ML ignoré`);
      }
    }

    return res.status(201).json({ message: "Feedback submitted successfully.", data: feedback });

  } catch (err) {
    return res.status(500).json({ message: "Failed to submit feedback.", error: err.message });
  }
};

export const getFeedbackByTrajet = async (req, res) => {
  const { trajetId } = req.params;
  try {
    const feedback = await prisma.evaluation.findUnique({
      where: { trajetId: parseInt(trajetId) },
    });
    return res.status(200).json({ message: "Feedback retrieved successfully.", data: feedback ? [feedback] : [] });
  } catch (err) {
    return res.status(500).json({ message: "Failed to retrieve feedback.", error: err.message });
  }
};

export const getDriverFeedback = async (req, res) => {
  const driverId = req.user.driverId;
  if (!driverId)
    return res.status(403).json({ message: "Access restricted to drivers only." });

  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const feedbacks = await prisma.evaluation.findMany({
      where:   { trajet: { driverId } },
      include: {
        trajet: {
          select: {
            id: true, startAddress: true, endAddress: true, dateDepart: true,
            passenger: { select: { id: true, nom: true, prenom: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const totalFeedbacks = await prisma.evaluation.count({ where: { trajet: { driverId } } });

    return res.status(200).json({
      message: "Feedback retrieved successfully.",
      data:    feedbacks,
      pagination: {
        currentPage:  page,
        totalPages:   Math.ceil(totalFeedbacks / limit),
        totalFeedbacks,
        limit,
        hasNextPage: page < Math.ceil(totalFeedbacks / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to retrieve feedback.", error: err.message });
  }
};

export const getDriverStats = async (req, res) => {
  const driverId = req.user.driverId;
  if (!driverId)
    return res.status(403).json({ message: "Access restricted to drivers only." });

  try {
    const driver = await prisma.driver.findUnique({
      where:  { id: driverId },
      select: { avgRating: true, ratingsCount: true },
    });
    if (!driver)
      return res.status(404).json({ message: "Driver not found." });

    return res.status(200).json({
      message: "Driver stats retrieved successfully.",
      data:    { averageRating: driver.avgRating || 0, totalFeedbacks: driver.ratingsCount || 0 },
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to retrieve driver stats.", error: err.message });
  }
};

export const getPublicDriverStats = async (req, res) => {
  const { driverId } = req.params;
  try {
    const driver = await prisma.driver.findUnique({
      where:  { id: parseInt(driverId) },
      select: { avgRating: true, ratingsCount: true, nom: true, prenom: true },
    });
    if (!driver)
      return res.status(404).json({ message: "Driver not found." });

    return res.status(200).json({
      message: "Driver stats retrieved successfully.",
      data: {
        averageRating:  driver.avgRating    || 0,
        totalFeedbacks: driver.ratingsCount || 0,
        driverName:     `${driver.prenom} ${driver.nom}`,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to retrieve driver stats.", error: err.message });
  }
};

export const getPublicDriverFeedback = async (req, res) => {
  const { driverId } = req.params;
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip  = (page - 1) * limit;

    const feedbacks = await prisma.evaluation.findMany({
      where: { trajet: { driverId: parseInt(driverId) } },
      select: {
        id: true, rating: true, comment: true, createdAt: true,
        trajet: {
          select: {
            startAddress: true, endAddress: true, dateDepart: true,
            passenger: { select: { prenom: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const totalFeedbacks = await prisma.evaluation.count({ where: { trajet: { driverId: parseInt(driverId) } } });

    return res.status(200).json({
      message: "Public feedback retrieved successfully.",
      data:    feedbacks,
      pagination: {
        currentPage:  page,
        totalPages:   Math.ceil(totalFeedbacks / limit),
        totalFeedbacks,
        limit,
        hasNextPage: page < Math.ceil(totalFeedbacks / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to retrieve public feedback.", error: err.message });
  }
};