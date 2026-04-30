import { validatePassword } from "../utils/validatePassword.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { getJwtSecrets } from "../utils/jwtConfig.js";

// LOGIN PASSENGER
export const loginPassenger = async (req, res) => {
  const { email, password } = req.body;

  try {
    const { accessSecret, refreshSecret } = getJwtSecrets();
    const normalizedEmail = email?.trim();
    const passenger = await prisma.passenger.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    });

    if (!passenger) {
      return res.status(400).json({ message: "Passenger not found." });
    }

    const validPassword = await bcrypt.compare(password, passenger.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // FIX: Utiliser passengerId au lieu de id
    const accessToken = jwt.sign(
      { passengerId: passenger.id, email: passenger.email, role: "passenger" },
      accessSecret,
      { expiresIn: "1h" },
    );

    const refreshToken = jwt.sign(
      { passengerId: passenger.id, role: "passenger" },
      refreshSecret,
      { expiresIn: "90d" },
    );

    passenger.password = undefined;

    res.status(200).json({
      message: "Login successful.",
      data: { passenger, accessToken, refreshToken },
    });
  } catch (err) {
    console.error("❌ Erreur login:", err);
    res.status(500).json({ message: "Failed to Login", error: err.message });
  }
};

export const validatePassengerLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const normalizedEmail = email?.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required." });
    }

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required." });
    }

    const passenger = await prisma.passenger.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    });

    if (!passenger) {
      return res.status(400).json({ message: "Passenger not found." });
    }

    const validPassword = await bcrypt.compare(password, passenger.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid password" });
    }

    return res.status(200).json({ message: "Credentials are valid." });
  } catch (err) {
    console.error("Passenger credential validation error:", err);
    return res
      .status(500)
      .json({ message: "Failed to validate passenger credentials." });
  }
};

// REGISTER PASSENGER
export const registerPassenger = async (req, res) => {
  console.log("📝 registerPassenger called, body:", req.body); // ← ajoute ça
  const { email, password, confirmPassword, nom, prenom, age, numTel, sexe } =
    req.body;

  try {
    const { accessSecret, refreshSecret } = getJwtSecrets();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    if (age < 18) {
      return res
        .status(400)
        .json({ message: "You must be at least 18 years old to register." });
    }

    if (age > 100) {
      return res
        .status(400)
        .json({ message: "Age must be 100 or less." });
    }

    if (!sexe?.trim()) {
      return res.status(400).json({ message: "Gender is required." });
    }

    if (!["m", "f"].includes(sexe.trim().toLowerCase())) {
      return res
        .status(400)
        .json({ message: 'Gender must be "Male" or "Female".' });
    }

    const existingPassenger = await prisma.passenger.findFirst({
      where: {
        email: {
          equals: email.trim(),
          mode: "insensitive",
        },
      },
    });

    if (existingPassenger) {
      return res.status(400).json({ message: "This email is already in use." });
    }

    // Phone numbers are not required to be unique; allow duplicates.

    const hashedPassword = await bcrypt.hash(password, 10);

    const newPassenger = await prisma.passenger.create({
      data: {
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        nom: nom.trim(),
        prenom: prenom.trim(),
        age,
        numTel,
        sexe: sexe.trim().toUpperCase(),
      },
    });

    // Utiliser passengerId au lieu de id
    const accessToken = jwt.sign(
      {
        passengerId: newPassenger.id,
        email: newPassenger.email,
        role: "passenger",
      },
      accessSecret,
      { expiresIn: "1h" },
    );

    const refreshToken = jwt.sign(
      { passengerId: newPassenger.id, role: "passenger" },
      refreshSecret,
      { expiresIn: "90d" },
    );

    newPassenger.password = undefined;

    res.status(201).json({
      message: "Passenger registered successfully.",
      data: { passenger: newPassenger, accessToken, refreshToken },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to register passenger.", error: err.message });
  }
};

export const refreshPassengerToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token manquant" });
  }

  try {
    const { accessSecret, refreshSecret } = getJwtSecrets();
    const decoded = jwt.verify(refreshToken, refreshSecret);

    const newAccessToken = jwt.sign(
      {
        passengerId: decoded.passengerId,
        email: decoded.email,
        role: "passenger",
      },
      accessSecret,
      { expiresIn: "1h" },
    );

    res.status(200).json({ accessToken: newAccessToken });
  } catch (err) {
    return res
      .status(403)
      .json({ message: "Refresh token invalide ou expiré" });
  }
};
