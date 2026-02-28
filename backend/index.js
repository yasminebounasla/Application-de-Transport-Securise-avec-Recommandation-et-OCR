import './env.js';  // MUST BE FIRST

import { createServer } from 'http';
import { prisma } from "./src/config/prisma.js";
import { initSocket } from "./src/socket/socket.js";
import app from "./app.js";

console.log('🔍 ENV CHECK:');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'LOADED ✅' : 'MISSING ❌');
console.log('ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? 'LOADED ✅' : 'MISSING ❌');

import os from 'os';


const PORT = process.env.PORT || 4040;

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");

    const httpServer = createServer(app);

    // Initialise Socket.IO proprement
    initSocket(httpServer);

    // Discover local IPv4 addresses for clearer instructions
    const nets = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push(net.address);
        }
      }
    }

    httpServer.listen(PORT, "0.0.0.0", () => {
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
    });

  } catch (error) {
    console.error("❌ Database connection failed", error);
    process.exit(1);
  }
};

startServer();