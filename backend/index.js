import './env.js';  // ✅ MUST BE FIRST, before ANY other imports

import { createServer } from 'http';
import { Server } from 'socket.io'; 
import express from 'express';
import cors from 'cors';
import { prisma } from "./src/config/prisma.js"; 

// Routes
import authRoutes from './src/routes/authRoutes.js';
import driverRoutes from './src/routes/driverRoutes.js';
import passengerRoutes from './src/routes/passengerRoutes.js';
import recommendationRoutes from './src/routes/recommendationRoutes.js';
import rideRoutes from './src/routes/rideRoutes.js'; 
import ridesDemRoutes from './src/routes/ridesDemRoutes.js';
import exportRoute from './src/routes/exportRoute.js';
import feedbackRoutes from './src/routes/feedbackRoutes.js';
import verificationRoutes from './src/routes/verificationRoutes.js';

// Middleware
import { notFound, errorHandler } from "./src/middleware/errorHandler.js";


// Console check des variables d'environnement
console.log('🔍 ENV CHECK:');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'LOADED ✅' : 'MISSING ❌');
console.log('ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? 'LOADED ✅' : 'MISSING ❌');


const PORT = process.env.PORT || 4040;
const app = express();

// --- Middleware ---
app.use(
  cors({
    origin: process.env.FRONTEND_URL, 
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Logger pour toutes les requêtes
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] 📢 ${req.method} ${req.url}`);
  console.log(`📦 Payload Size: ${req.headers['content-length'] || 'unknown'} bytes`);
  next();
});

// --- Routes ---
app.get('/', (req, res) => {
  res.json({ message: "The server is running!" });
});

app.use("/api/auth", authRoutes);
app.use("/api/driver", recommendationRoutes);
app.use("/api/ride", rideRoutes);
app.use("/api/ridesDem", ridesDemRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/passengers", passengerRoutes);
app.use("/api/export", exportRoute);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/verification", verificationRoutes);

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

// --- Start Server avec Socket.IO ---
const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");

    // Crée le serveur HTTP à partir de Express
    const httpServer = createServer(app);

    // --- Socket.IO setup ---
    const io = new Server(httpServer, {
      cors: { origin: "*" }, // ou ton front si tu veux restreindre
    });

    io.on("connection", (socket) => {
      console.log("🔌 Client connecté :", socket.id);

      // Exemple : émission et réception de notification
      socket.on("sendNotification", (data) => {
        io.emit("receiveNotification", data);
      });

      socket.on("disconnect", () => {
        console.log("❌ Client déconnecté :", socket.id);
      });
    });

    // Lancer le serveur
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`
      🚀 SERVER IS LIVE
      -----------------------------------------
      Local:   http://localhost:${PORT}
      Network: ${process.env.FRONTEND_URL}
      -----------------------------------------
      If the phone fails, check Firewall/IP again.
      `);
    });

  } catch (error) {
    console.error("❌ Database connection failed", error);
    process.exit(1);
  }
};

startServer();