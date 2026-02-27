import './env.js';  // MUST BE FIRST

import { createServer } from 'http';
import { prisma } from "./src/config/prisma.js";
import { initSocket } from "./src/socket/socket.js";
import app from "./app.js";

console.log('🔍 ENV CHECK:');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'LOADED ✅' : 'MISSING ❌');
console.log('ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? 'LOADED ✅' : 'MISSING ❌');
<<<<<<< HEAD
import express from 'express';
import os from 'os';
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
=======
>>>>>>> 65c1b12aa6e20dbfbacfa899a22b76db9a325340

const PORT = process.env.PORT || 4040;

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");
<<<<<<< HEAD
    
    // Listening on '0.0.0.0' allows external devices (phones) to connect
    app.listen(PORT, '0.0.0.0', () => {
      // discover local IPv4 addresses for clearer instructions
      const nets = os.networkInterfaces();
      const addresses = [];
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            addresses.push(net.address);
          }
        }
      }

      console.log('\n🚀 SERVER IS LIVE');
      console.log('-----------------------------------------');
      console.log(`Local:   http://localhost:${PORT}`);
      if (addresses.length) {
        addresses.forEach((a) => console.log(`Network: http://${a}:${PORT}`));
      } else {
        console.log(`Network: (no non-internal IPv4 found)`);
      }
      console.log('-----------------------------------------');
      console.log('If the phone fails to connect, check Windows Firewall and ensure this port is allowed.');
=======

    const httpServer = createServer(app);

    // Initialise Socket.IO proprement
    initSocket(httpServer);

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`
      🚀 SERVER IS LIVE
      -----------------------------------------
      Local:   http://localhost:${PORT}
      -----------------------------------------
      `);
>>>>>>> 65c1b12aa6e20dbfbacfa899a22b76db9a325340
    });

  } catch (error) {
    console.error("❌ Database connection failed", error);
    process.exit(1);
  }
};

startServer();