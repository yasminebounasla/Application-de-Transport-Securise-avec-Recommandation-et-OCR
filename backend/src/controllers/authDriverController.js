import { validatePassword } from "../utils/validatePassword.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { getJwtSecrets } from "../utils/jwtConfig.js";

export const registerDriver = async (req, res) => {
  const { email, password, confirmPassword, nom, prenom, age, numTel, sexe } =
    req.body;

  try {
    const { accessSecret, refreshSecret } = getJwtSecrets();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

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

    const existingDriver = await prisma.driver.findFirst({
      where: {
        email: {
          equals: email.trim(),
          mode: "insensitive",
        },
      },
    });

    if (existingDriver) {
      return res.status(400).json({ message: "Driver already registered." });
    }

    // Phone numbers are not required to be unique; allow duplicates.

    const hashedPassword = await bcrypt.hash(password, 10);

    const newDriver = await prisma.driver.create({
      data: {
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        nom: nom.trim(),
        prenom: prenom.trim(),
        age,
        numTel,
        sexe: sexe.trim()[0].toUpperCase(),
        // ✅ fumeur supprimé car pas dans le schema
        isVerified: false,
      },
    });

    const accessToken = jwt.sign(
      { driverId: newDriver.id, email: newDriver.email, role: "driver" },
      accessSecret,
      { expiresIn: "1h" },
    );

    const refreshToken = jwt.sign(
      { driverId: newDriver.id, role: "driver" },
      refreshSecret,
      { expiresIn: "90d" },
    );

    newDriver.password = undefined;

    res.status(201).json({
      message: "Driver registered successfully.",
      data: { newDriver, accessToken, refreshToken },
    });
  } catch (err) {
    console.error("❌ [REGISTRATION ERROR]", err);
    console.error("Error message:", err.message);
    console.error("Stack trace:", err.stack);
    res.status(500).json({
      message: "Failed to register Driver.",
      error: err.message,
    });
  }
};

export const loginDriver = async (req, res) => {
  const { email, password } = req.body;

  try {
    const { accessSecret, refreshSecret } = getJwtSecrets();
    const normalizedEmail = email?.trim();
    const driver = await prisma.driver.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    });

    if (!driver) {
      return res.status(400).json({ message: "Driver not found." });
    }

    const validPassword = await bcrypt.compare(password, driver.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const accessToken = jwt.sign(
      { driverId: driver.id, email: driver.email, role: "driver" },
      accessSecret,
      { expiresIn: "1h" },
    );

    const refreshToken = jwt.sign(
      { driverId: driver.id, role: "driver" },
      refreshSecret,
      { expiresIn: "90d" },
    );
    driver.password = undefined;

    res.status(200).json({
      message: "Login successful.",
      data: { driver, accessToken, refreshToken },
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to Login",
      error: err.message,
    });
  }
};

export const validateDriverLogin = async (req, res) => {
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

    const driver = await prisma.driver.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    });

    if (!driver) {
      return res.status(400).json({ message: "Driver not found." });
    }

    const validPassword = await bcrypt.compare(password, driver.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid password" });
    }

    return res.status(200).json({ message: "Credentials are valid." });
  } catch (err) {
    console.error("Driver credential validation error:", err);
    return res
      .status(500)
      .json({ message: "Failed to validate driver credentials." });
  }
};

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
        // ✅ fumeur supprimé
        talkative: true,
        radio_on: true,
        smoking_allowed: true,
        pets_allowed: true,
        car_big: true,
        works_morning: true,
        works_afternoon: true,
        works_evening: true,
        works_night: true,
        avgRating: true,
        isVerified: true,
        latitude: true,
        longitude: true,
      },
    });

    res.status(200).json({
      message: "Drivers retrieved successfully.",
      data: drivers,
    });
  } catch (err) {
    console.error("❌ [GET ALL DRIVERS ERROR]", err);
    console.error("Error message:", err.message);
    console.error("Stack trace:", err.stack);
    res.status(500).json({
      message: "Failed to retrieve drivers.",
      error: err.message,
    });
  }
};

export const refreshDriverToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token manquant" });
  }

  try {
    const { accessSecret, refreshSecret } = getJwtSecrets();
    const decoded = jwt.verify(refreshToken, refreshSecret);

    const newAccessToken = jwt.sign(
      { driverId: decoded.driverId, email: decoded.email, role: "driver" },
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
export const checkEmailExists = async (req, res) => {
  const { email } = req.body;

  try {
    console.log('🔍 Checking email:', email);
    
    const driverExists = await prisma.driver.findFirst({
      where: {
        email: {
          equals: email.trim(),
          mode: "insensitive",
        },
      },
    });
    console.log('Driver found:', !!driverExists);

    const passengerExists = await prisma.passenger.findFirst({
      where: {
        email: {
          equals: email.trim(),
          mode: "insensitive",
        },
      },
    });
    console.log('Passenger found:', !!passengerExists);

    if (driverExists || passengerExists) {
      console.log('❌ Email already exists - returning 409');
      return res.status(409).json({ message: "This email is already in use." });
    }

    console.log('✅ Email available - returning 200');
    return res.status(200).json({ available: true });
  } catch (err) {
    console.error('❌ Error checking email:', err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const checkPhoneExists = async (req, res) => {
  const { phoneNumber, role } = req.body;

  try {
    const normalizedPhone = phoneNumber?.trim();

    if (!normalizedPhone) {
      return res.status(400).json({ message: "Phone number is required." });
    }

    if (!["driver", "passenger"].includes(role)) {
      return res.status(400).json({ message: "Invalid role." });
    }

    // Phone uniqueness is no longer enforced — always return available
    return res.status(200).json({ available: true });
  } catch (err) {
    console.error("Phone check error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};
