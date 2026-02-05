import { validatePassword } from "../utils/validatePassword.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";

const jwtSecret = process.env.JWT_SECRET;

export const registerDriver = async (req, res) => {
    const {email, password,confirmPassword, nom, prenom, age, numTel, sexe} = req.body;

    try{
        //verifier la format de l'email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        //valider le mot de passe
        const passwordError = validatePassword(password);
        if(passwordError) {
            return res.status(400).json({ message: passwordError });
        }

        if(password !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match." });
        };

        if(age < 17) {
            return res.status(400).json({ message: "You must be at least 17 years old to register." });
        }   

        // verifier si le passager existe déjà
        const existingDriver = await prisma.driver.findUnique({
            where: { email : email.trim().toLowerCase() }
        });

        if(existingDriver) {
            return res.status(400).json({ message: "Driver already registered." });
        } 

        // hacher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // créer un nouveau conducteur
        const newDriver = await prisma.driver.create({
            data: {
                email: email.trim().toLowerCase(),
                password: hashedPassword,
                nom: nom.trim(),
                prenom: prenom.trim(),
                age,
                numTel,
                sexe: sexe.trim()[0].toUpperCase(),  // "M" ou "F"
                fumeur: false,             // par défaut false
                carteIdNum: null,                     // pas encore fourni
                isVerified: false
            }
            });



        const token = jwt.sign(
            { id: newDriver.id, email: newDriver.email },
            jwtSecret,
            { expiresIn: "1h" }
        );

        newDriver.password = undefined;

        res.status(201).json({
            message: "Driver registered successfully.",
            data :  { newDriver, token }
        });

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

export const getAllDrivers = async (req, res) => { 
    try {
        const drivers = await prisma.driver.findMany({
            select: {
                id: true,
                email: true,
                nom: true,
                prenom: true,
                age: true,
                numTel: true,
                sexe: true,
                fumeur: true,
                talkative: true,
                radio_on: true,
                smoking_allowed: true,
                pets_allowed: true,
                car_big: true,
                works_morning: true,
                works_afternoon: true,
                works_evening: true,
                works_night: true,
                isVerified: true
            }
        });
        
        //  Retourne directement l'array (sans wrapper)
        res.status(200).json(drivers);
        
    } catch (err) {
        res.status(500).json({
            message: "Failed to retrieve drivers.",
            error: err.message
        });
    }
};

export const deleteAllDrivers = async (req, res) => { 
    try {
        const result = await prisma.driver.deleteMany({});
        
        res.status(200).json({
            message: "All drivers deleted successfully.",
            deletedCount: result.count
        });
    } catch (err) {
        res.status(500).json({
            message: "Failed to delete drivers.",
            error: err.message
        });
    }
};