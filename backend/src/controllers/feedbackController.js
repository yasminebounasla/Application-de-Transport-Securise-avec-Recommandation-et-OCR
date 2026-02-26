import { prisma } from "../config/prisma.js";
import { getIO } from "../config/socket.js";

// Soumettre un feedback
export const submitFeedback = async (req, res) => {

    const { trajetId, rating, comment } = req.body;
    try {

        // Vérifie que le trajet existe
        const trajet = await prisma.trajet.findUnique({
            where: { id: trajetId },
            include: { driver: true }
        });
        if (!trajet) {
            return res.status(404).json({ message: "Trajet not found." });
        }


        // Vérifie que le trajet est terminé
        if (trajet.status !== "COMPLETED") {
            return res.status(400).json({
                message: "Feedback can only be submitted for completed trajets."
            });
        }

        // Vérifie si un feedback existe déjà
        const existingFeedback = await prisma.evaluation.findUnique({
            where: { trajetId }
        });
        if (existingFeedback) {
            return res.status(400).json({
                message: "Vous avez déjà soumis un feedback pour ce trajet."
            });
        }

        // Crée le feedback
        const feedback = await prisma.evaluation.create({
            data: {
                trajetId,
                rating,
                comment
            }
        });


        // Met à jour le conducteur
        const driver = trajet.driver;
        if (driver) {
            const newRatingsCount = (driver.ratingsCount || 0) + 1;
            const newAvgRating = ((driver.avgRating || 0) * (driver.ratingsCount || 0) + rating) / newRatingsCount;
            
            await prisma.driver.update({
                where: { id: driver.id },
                data: {
                    ratingsCount: newRatingsCount,
                    avgRating: newAvgRating
                }
            });
        }

        const io = getIO();
        io.to(trajet.driverId).emit('newFeedback', {
            trajetId: trajet.id,
            rating,
            comment,
            passengerName: `${trajet.passenger.prenom} ${trajet.passenger.nom}`
        });

        return res.status(201).json({
            message: "Feedback submitted successfully.",
            data: feedback
        });

    } catch (err) {
        return res.status(500).json({
            message: "Failed to submit feedback.",
            error: err.message
        });
    }
};


// GET feedback pour un trajet spécifique
export const getFeedbackByTrajet = async (req, res) => {
    const { trajetId } = req.params;
    
    try {
        const feedback = await prisma.evaluation.findUnique({
            where: { trajetId: parseInt(trajetId) }
        });
        
        return res.status(200).json({
            message: "Feedback retrieved successfully.",
            data: feedback ? [feedback] : []
        });
    } catch (err) {
        return res.status(500).json({
            message: "Failed to retrieve feedback.",
            error: err.message
        });
    }
};

// GET tous les feedbacks d'un driver (pour le profile personel du driver)
export const getDriverFeedback = async (req, res) => {
    const driverId = req.user.driverId;
    if (!driverId) {
        return res.status(403).json({ message: "Access restricted to drivers only." });
    }
    
    try {

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Récupérer les feedbacks
        const feedbacks = await prisma.evaluation.findMany({
            where: {
                trajet: {
                    driverId: driverId
                }
            },
            include: {
                trajet: {
                    select: {
                        id: true,
                        startAddress: true,
                        endAddress: true,
                        dateDepart: true,
                        passenger: {  // Info du passager
                            select: {
                                id: true,
                                nom: true,
                                prenom: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: skip,
            take: limit
        });

        // Compter le total
        const totalFeedbacks = await prisma.evaluation.count({
            where: {
                trajet: {
                    driverId: driverId
                }
            }
        });

        return res.status(200).json({
            message: "Feedback retrieved successfully.",
            data: feedbacks,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalFeedbacks / limit),
                totalFeedbacks: totalFeedbacks,
                limit: limit,
                hasNextPage: page < Math.ceil(totalFeedbacks / limit),
                hasPrevPage: page > 1
            }
        });
    } catch(err) {
        return res.status(500).json({
            message: "Failed to retrieve feedback.",
            error: err.message
        });
    }   
};

// GET stats d'un driver (avg + total)  (pour le profile personnel du driver)
export const getDriverStats = async (req, res) => {
    const driverId = req.user.driverId;
    if (!driverId) {
        return res.status(403).json({ message: "Access restricted to drivers only." });
    }
    
    try {
        // Récupérer les stats depuis la table Driver 
        const driver = await prisma.driver.findUnique({
            where: { id: driverId },
            select: {
                avgRating: true,
                ratingsCount: true
            }
        });

        if (!driver) {
            return res.status(404).json({ message: "Driver not found." });
        }

        return res.status(200).json({
            message: "Driver stats retrieved successfully.",
            data: {
                averageRating: driver.avgRating || 0,
                totalFeedbacks: driver.ratingsCount || 0
            }
        });
    } catch(err) {
        return res.status(500).json({
            message: "Failed to retrieve driver stats.",
            error: err.message
        });
    }
};

// GET stats d'un driver PUBLIC (pour les passagers qui voient son profil)
export const getPublicDriverStats = async (req, res) => {
    const { driverId } = req.params;
    
    try {
        const driver = await prisma.driver.findUnique({
            where: { id: parseInt(driverId) },
            select: {
                avgRating: true,
                ratingsCount: true,
                user: {
                    select: {
                        nom: true,
                        prenom: true
                    }
                }
            }
        });

        if (!driver) {
            return res.status(404).json({ message: "Driver not found." });
        }

        return res.status(200).json({
            message: "Driver stats retrieved successfully.",
            data: {
                averageRating: driver.avgRating || 0,
                totalFeedbacks: driver.ratingsCount || 0,
                driverName: `${driver.user.prenom} ${driver.user.nom}`
            }
        });
    } catch(err) {
        return res.status(500).json({
            message: "Failed to retrieve driver stats.",
            error: err.message
        });
    }
};

// GET feedbacks publics d'un driver (pour les passagers qui voient son profil)
export const getPublicDriverFeedback = async (req, res) => {
    const { driverId } = req.params;
    
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5; // Moins par défaut pour le public
        const skip = (page - 1) * limit;

        const feedbacks = await prisma.evaluation.findMany({
            where: {
                trajet: {
                    driverId: parseInt(driverId)
                }
            },
            select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
                trajet: {
                    select: {
                        startAddress: true,
                        endAddress: true,
                        dateDepart: true,
                        passenger: {
                            select: {
                                prenom: true // Juste prénom pour anonymat partiel
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: skip,
            take: limit
        });

        const totalFeedbacks = await prisma.evaluation.count({
            where: {
                trajet: {
                    driverId: parseInt(driverId)
                }
            }
        });

        return res.status(200).json({
            message: "Public feedback retrieved successfully.",
            data: feedbacks,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalFeedbacks / limit),
                totalFeedbacks: totalFeedbacks,
                limit: limit,
                hasNextPage: page < Math.ceil(totalFeedbacks / limit),
                hasPrevPage: page > 1
            }
        });
    } catch(err) {
        return res.status(500).json({
            message: "Failed to retrieve public feedback.",
            error: err.message
        });
    }
};