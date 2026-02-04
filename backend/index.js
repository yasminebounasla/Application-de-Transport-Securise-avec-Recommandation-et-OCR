import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from "./src/config/prisma.js"; 
import authRoutes from './src/routes/authRoutes.js';
import recommendationRoutes from './src/routes/recommendationRoutes.js';
import rideRoutes from './src/routes/rideRoutes.js'; 
import { notFound, errorHandler } from "./src/middleware/errorHandler.js";

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

// Middleware
app.use(
  cors({
    origin: "*", 
    credentials: true,
  })
);
app.use(express.json());

// Sample route
app.get('/', (req, res) => {
  res.json({ message: "the server is running!" });
});

app.use("/api/auth", authRoutes);
app.use("/api/recomnmendations", recommendationRoutes);
app.use("/api/ride", rideRoutes);
// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);


const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to connect to the database");
    console.error(error);
    process.exit(1);
  }
};

startServer();