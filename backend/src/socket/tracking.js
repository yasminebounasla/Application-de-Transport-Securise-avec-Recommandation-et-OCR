import { Server } from "socket.io";

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("🔌 User connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.id);
    });
  });
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

// This module adds handlers for ride-tracking related websocket events.
// - subscribeToRide: passenger (or any client) joins a room for a specific
//   ride so they can receive location updates.
// - driverLocationUpdate: driver emits their current position and we broadcast
//   it to everyone listening on the ride room (typically the passenger).

export const registerTrackingHandlers = (socket) => {
  // client wants to listen to a particular ride
  socket.on("subscribeToRide", (rideId) => {
    if (!rideId) return;
    const room = `ride_${rideId}`;
    socket.join(room);
    console.log(`📍 Socket ${socket.id} subscribed to ride ${rideId}`);
  });

  // driver is pushing location updates
  socket.on("driverLocationUpdate", ({ rideId, location }) => {
    if (!rideId || !location) return;
    const room = `ride_${rideId}`;
    // broadcast to everyone except the sender
    socket.to(room).emit("driverLocationUpdate", { rideId, location });
    console.log(`🚘 Location update for ride ${rideId}:`, location);
  });
};
