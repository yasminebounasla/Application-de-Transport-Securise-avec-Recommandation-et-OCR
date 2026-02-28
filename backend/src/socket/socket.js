import { Server } from "socket.io";

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL || "*", credentials: true },
  });

  io.on("connection", (socket) => {
    console.log("🔌 Client connecté :", socket.id);

    // ----- Notifications passager -----
    socket.on("registerUser", (userId) => {
      socket.join(`passenger_${userId}`);
      console.log(`✅ Passenger ${userId} joined room`);
    });

    // ✅ Room pour le driver
    socket.on("registerDriver", (driverId) => {
    socket.join(`driver_${driverId}`);
    console.log(`✅ Driver ${driverId} joined room`);
    });

    // ----- Tracking conducteur -----
    socket.on("subscribeToRide", (rideId) => {
      socket.join(`ride_${rideId}`);
      console.log(`📍 Socket ${socket.id} subscribed to ride ${rideId}`);
    });

    socket.on("driverLocationUpdate", ({ rideId, location }) => {
      socket.to(`ride_${rideId}`).emit("driverLocationUpdate", { rideId, location });
      console.log(`🚘 Location update for ride ${rideId}:`, location);
    });

    socket.on("disconnect", () => {
      console.log("❌ Client déconnecté :", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};