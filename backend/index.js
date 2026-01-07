import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from "./src/config/prisma.js"; // ✅ Un seul import

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173"], 
    credentials: true,
  })
);
app.use(express.json());

// ❌ SUPPRIME CETTE LIGNE (doublon) :
// const prisma = new prismaConfig.PrismaClient();

// Sample route
app.get('/', (req, res) => {
  res.json({ message: "the server is running!" });
});

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