import { validatePassword } from "../utils/validatePassword.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";

const jwtSecret = process.env.JWT_SECRET;


// LOGIN PASSENGER
export const loginPassenger = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const passenger = await prisma.passenger.findUnique({
      where: { email: email.trim().toLowerCase() }
    });
    
    if (!passenger) {
      return res.status(400).json({ message: "Passenger not found." });
    }
    
    const validPassword = await bcrypt.compare(password, passenger.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid password" });
    }
    
    // FIX: Utiliser passengerId au lieu de id
    const token = jwt.sign(
      {
        passengerId: passenger.id,  
        email: passenger.email,
        name: `${passenger.nom} ${passenger.prenom}`
      },
      jwtSecret,
      { expiresIn: "7d" }
    );
    
    passenger.password = undefined;
    
    res.status(200).json({
      message: "Login successful.",
      data: { passenger, token }
    });
    
  } catch (err) {
    console.error('❌ Erreur login:', err);
    res.status(500).json({ message: "Failed to Login", error: err.message });
  }
};


// REGISTER PASSENGER
export const registerPassenger = async (req, res) => {
  const { email, password, confirmPassword, nom, prenom, age, numTel } = req.body;
  
  try {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });
    
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }
    
    if (age < 17) {
      return res.status(400).json({ message: "You must be at least 17 years old to register." });
    }
    
    const existingPassenger = await prisma.passenger.findUnique({
      where: { email: email.trim().toLowerCase() }
    });
    
    if (existingPassenger) {
      return res.status(400).json({ message: "Passenger already registered." });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newPassenger = await prisma.passenger.create({
      data: {
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        nom: nom.trim(),
        prenom: prenom.trim(),
        age,
        numTel
      }
    });
    
    // Utiliser passengerId au lieu de id
    const token = jwt.sign(
      {
        passengerId: newPassenger.id,  
        email: newPassenger.email,
        name: `${newPassenger.nom} ${newPassenger.prenom}`
      },
      jwtSecret,
      { expiresIn: "7d" }
    );
    
    newPassenger.password = undefined;
    
    res.status(201).json({
      message: "Passenger registered successfully.",
      data: { newPassenger, token }
    });
    
  } catch (err) {
    res.status(500).json({ message: "Failed to register passenger.", error: err.message });
  }
};