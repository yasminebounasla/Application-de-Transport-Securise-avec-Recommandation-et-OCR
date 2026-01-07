import { validatePassword } from "../utils/validatePassword";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";

const jwtSecret = process.env.JWT_SECRET;

export const registerPassenger = async (req, res) => {
    const {email, password,confirmPassword, nom, prenom, age,  numTel} = req.body;

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
        const existingPassenger = await prisma.passenger.findUnique({
            where: { email : email.trim().toLowerCase() }
        });

        if(existingPassenger) {
            return res.status(400).json({ message: "Passenger already registered." });
        } 

        // hacher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // créer un nouveau passager
        const newPassenger = await prisma.passenger.create({
            data: {
                email: email.trim().toLowerCase(),  
                password: hashedPassword,
                nom : nom.trim(),
                prenom : prenom.trim(),
                age,
                numTel
            }
        });

        const token = jwt.sign(
            { id: newPassenger.id, email: newPassenger.email },
            jwtSecret,
            { expiresIn: "1h" }
        );

        newPassenger.password = undefined;

        res.status(201).json({
            message: "Passenger registered successfully.",
            data :  { newPassenger, token }
        });

    } catch(err) {
        res.status(500).json({
            message: "Failed to register passenger.",
            error: err.message
        });
    }
}

export const loginPassenger = async (req, res) => {
    const { email, password } = req.body;

    try {
        //trouver le passager par email
        const passenger = await prisma.passenger.findUnique({
            where: { email: email.trim().toLowerCase() }
        });

        if(!passenger) {
            return res.status(400).json({ message: "Passenger not found."});
        }

        //verifier le mot de passe
        const validPassword = await bcrypt.compare(password, userExist.password)
        if( !validPassword )  {

            return res.status(400).json({
                message : "Invalid password"
            })
        }

        const token = jwt.sign(
            { id: passenger.id, email: passenger.email },
            jwtSecret,
            { expiresIn: "1h" }
        );

        userExist.password = undefined;

        res.status(200).json({
            message: "Login successful.",
            data: { passenger, token }
        });

    }catch(err) {
        res.status(500).json({
            message: "Failed to Login",
            error: err.message
        })
    }
}