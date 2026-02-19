
import dotenv from 'dotenv';
dotenv.config();  // ✅ MUST BE FIRST, before ANY other imports

// Now add console checks
console.log('🔍 ENV CHECK:');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'LOADED ✅' : 'MISSING ❌');
console.log('ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? 'LOADED ✅' : 'MISSING ❌');
import express from 'express';
import cors from 'cors';
import { prisma } from "./src/config/prisma.js"; 
import authRoutes from './src/routes/authRoutes.js';
import driverRoutes from './src/routes/driverRoutes.js';
import passengerRoutes from './src/routes/passengerRoutes.js';
import recommendationRoutes from './src/routes/recommendationRoutes.js';
import rideRoutes from './src/routes/rideRoutes.js'; 
import ridesDemRoutes from './src/routes/ridesDemRoutes.js'
import { notFound, errorHandler } from "./src/middleware/errorHandler.js";
import exportRoute from './src/routes/exportRoute.js';
import feedbackRoutes from './src/routes/feedbackRoutes.js';

import verificationRoutes from './src/routes/verificationRoutes.js';

dotenv.config();

const PORT = process.env.PORT || 4040;
const app = express();

// Middleware
app.use(
  cors({
    origin: "*", 
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// Dans ton backend/index.js, juste après app.use(cors(...))
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] 📢 ${req.method} ${req.url}`);
  console.log(`📦 Payload Size: ${req.headers['content-length'] || 'unknown'} bytes`);
  next();
});
// Sample route
app.get('/', (req, res) => {
  res.json({ message: "the server is running!" });
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


// const startServer = async () => {
//   try {
//     await prisma.$connect();
//     console.log("✅ Database connected");
    
//     app.listen(PORT, () => {
//       console.log(`🚀 Server running at http://localhost:${PORT}`);
//     });
//   } catch (error) {
//     console.error("❌ Failed to connect to the database");
//     console.error(error);
//     process.exit(1);
//   }
// };
// --- UPDATED LISTEN BLOCK ---
const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");
    
    // Listening on '0.0.0.0' allows external devices (phones) to connect
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
      🚀 SERVER IS LIVE
      -----------------------------------------
      Local:   http://localhost:${PORT}
      Network: http://192.168.1.69:${PORT}
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