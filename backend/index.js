import './env.js';  // MUST BE FIRST

import { createServer } from 'http';
import { prisma } from "./src/config/prisma.js";
import { initSocket } from "./src/socket/socket.js";
import app from "./app.js";

console.log('🔍 ENV CHECK:');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'LOADED ✅' : 'MISSING ❌');
console.log('ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? 'LOADED ✅' : 'MISSING ❌');

const PORT = process.env.PORT || 4040;

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");

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
    });

  } catch (error) {
    console.error("❌ Database connection failed", error);
    process.exit(1);
  }
};

startServer();