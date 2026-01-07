import { validatePassword } from "../utils/validatePassword";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";

const jwtSecret = process.env.JWT_SECRET;

export const registerPassenger = async (req, res) => {
    try{
       
    } catch(err) {
        res.status(500).json({
            message: "Failed to register Driver.",
            error: err.message
        });
    }
}

export const loginDriver = async (req, res) => {
    const { email, password } = req.body;

    try {
        //trouver le passager par email
        const driver = await prisma.driver.findUnique({
            where: { email: email.trim().toLowerCase() }
        });

        if(!driver) {
            return res.status(400).json({ message: "Driver not found."});
        }

        //verifier le mot de passe
        const validPassword = await bcrypt.compare(password, driver.password)
        if( !validPassword )  {

            return res.status(400).json({
                message : "Invalid password"
            })
        }

        const token = jwt.sign(
            { id: driver.id, email: driver.email },
            jwtSecret,
            { expiresIn: "1h" }
        );

        driver.password = undefined;

        res.status(200).json({
            message: "Login successful.",
            data: { driver, token }
        });

    }catch(err) {
        res.status(500).json({
            message: "Failed to Login",
            error: err.message
        })
    }
}