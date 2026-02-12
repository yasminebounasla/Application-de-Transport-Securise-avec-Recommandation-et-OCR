import { prisma } from "../config/prisma.js";

//create feedback + update the rating of driver 

export const submitFeedback = async (req, res) => {
    const { trajetId, rating, comment } = req.body;

    try {
        // vérifiy the tarjet status
        const trajet = await prisma.trajet.findUnique({
            where: {
                id: trajetId
            }
        })

        if(!trajet) {
            return res.status(404).json({
                message: "Trajet not found."
            });
        }

        if(trajet.status !== "COMPLETED") {
            return res.status(400).json({
                message: "Feedback can only be submitted for completed trajets."

            });
        }

        //create the feedback
        const feedback = await prisma.evaluation.create({
            data: {
                trajetId,
                rating,
                comment
            }
        });


        //update the driver rating
        const driverId = trajet.driverId;
        const driver = await prisma.driver.findUnique({
            where: {
                id: driverId
            }
        });

        driver.ratingsCount += 1;
        driver.rating =((driver.rating * (driver.ratingsCount - 1)) + rating) / driver.ratingsCount ;

        await prisma.driver.update({
            where: {
                id: driverId
            },
            data: {
                rating: driver.rating
            }
        });

        return res.status(201).json({
            message: "Feedback submitted successfully.",
            data: feedback
        })


    } catch(err) {
        return res.status(500).json({
            message: "Failed to submit feedback.",
            error: err.message
        });
    }
}


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