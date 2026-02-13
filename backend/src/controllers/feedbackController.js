import { prisma } from "../config/prisma.js";

export const submitFeedback = async (req, res) => {
    const { trajetId, rating, comment } = req.body;

    try {
        //  Vérifie que le trajet existe
        const trajet = await prisma.trajet.findUnique({
            where: { id: trajetId },
            include: { driver: true } // pour mettre à jour le rating après
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
            data: feedback ? [feedback] : [] // Array pour matcher le frontend 
        });
    } catch (err) {
        return res.status(500).json({
            message: "Failed to retrieve feedback.",
            error: err.message
        });
    }
};



export const getDriverFeedback = async (req, res) => {
    const driverId = req.user.driverId;

    if (!driverId) {
        return res.status(403).json({ message: "Access restricted to drivers only." });
    }
    
    try {

        //pagination
        const page = parseInt(req.query.page) || 1; // page actuelle depuis query params, par défaut 1
        const limit = parseInt(req.query.limit) || 10; // nombre de feedbacks par page

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
                        dateDepart: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        });

        return res.status(200).json({
            message: "Feedback retrieved successfully.",
            data: feedbacks
        });
    } catch(err) {
        return res.status(500).json({
            message: "Failed to retrieve feedback.",
            error: err.message
        });
    }   
}