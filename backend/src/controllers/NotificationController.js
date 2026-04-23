import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Helper : créer une notif en BD ────────────────────────────────────────────
// Utilisé par rideController, feedbackController, etc.
export async function createNotification({
  driverId = null,
  passengerId = null,
  recipientType,   // 'DRIVER' | 'PASSENGER'
  type,            // NotificationType enum
  title,
  message,
  data = null,
}) {
  return prisma.notification.create({
    data: {
      driverId,
      passengerId,
      recipientType,
      type,
      title,
      message,
      data,
      isRead: false,
    },
  });
}

// ── GET /api/notifications ────────────────────────────────────────────────────
// Retourne toutes les notifs du user connecté (driver ou passenger)
// Query params: ?unreadOnly=true pour filtrer
export const getMyNotifications = async (req, res) => {
  const { unreadOnly } = req.query;

  try {
    let where = {};

    if (req.user.driverId) {
      where = {
        driverId: req.user.driverId,
        recipientType: 'DRIVER',
        ...(unreadOnly === 'true' ? { isRead: false } : {}),
      };
    } else if (req.user.passengerId) {
      where = {
        passengerId: req.user.passengerId,
        recipientType: 'PASSENGER',
        ...(unreadOnly === 'true' ? { isRead: false } : {}),
      };
    } else {
      return res.status(400).json({ message: 'Utilisateur non identifié' });
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50, // max 50 notifs retournées
    });

    const unreadCount = await prisma.notification.count({
      where: { ...where, isRead: false },
    });

    return res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
    });

  } catch (error) {
    console.error('Erreur getMyNotifications:', error);
    return res.status(500).json({ message: error.message });
  }
};

// ── PATCH /api/notifications/read-all ────────────────────────────────────────
// Marque toutes les notifs comme lues
export const markAllAsRead = async (req, res) => {
  try {
    let where = {};

    if (req.user.driverId) {
      where = { driverId: req.user.driverId, isRead: false };
    } else if (req.user.passengerId) {
      where = { passengerId: req.user.passengerId, isRead: false };
    } else {
      return res.status(400).json({ message: 'Utilisateur non identifié' });
    }

    const { count } = await prisma.notification.updateMany({
      where,
      data: { isRead: true },
    });

    return res.status(200).json({ success: true, updated: count });

  } catch (error) {
    console.error('Erreur markAllAsRead:', error);
    return res.status(500).json({ message: error.message });
  }
};

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────
// Marque une notif spécifique comme lue
export const markOneAsRead = async (req, res) => {
  const { id } = req.params;

  try {
    const notifId = Number.parseInt(id, 10);
    if (Number.isNaN(notifId)) {
      return res.status(400).json({ success: false, message: 'Invalid notification id' });
    }

    let where = { id: notifId };

    if (req.user.driverId) {
      where = { ...where, driverId: req.user.driverId, recipientType: 'DRIVER' };
    } else if (req.user.passengerId) {
      where = { ...where, passengerId: req.user.passengerId, recipientType: 'PASSENGER' };
    } else {
      return res.status(400).json({ success: false, message: 'Utilisateur non identifié' });
    }

    const { count } = await prisma.notification.updateMany({
      where,
      data: { isRead: true },
    });

    if (!count) {
      return res.status(404).json({ success: false, message: 'Notification introuvable' });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ── DELETE /api/notifications ─────────────────────────────────────────────────
// Supprime toutes les notifs du user
export const clearMyNotifications = async (req, res) => {
  try {
    let where = {};

    if (req.user.driverId) {
      where = { driverId: req.user.driverId };
    } else if (req.user.passengerId) {
      where = { passengerId: req.user.passengerId };
    } else {
      return res.status(400).json({ message: 'Utilisateur non identifié' });
    }

    const { count } = await prisma.notification.deleteMany({ where });
    return res.status(200).json({ success: true, deleted: count });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
