import express from "express";
import cors from "cors";

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

const app = express();

// --- Middlewares ---
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] 📢 ${req.method} ${req.url}`);
  next();
});

// --- Routes ---
app.get('/', (req, res) => {
  res.json({ message: "Server is running 🚀" });
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

// --- Error Handling ---
app.use(notFound);
app.use(errorHandler);

export default app;