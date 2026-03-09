import { Server } from "socket.io";

let io;

export const registerTrackingHandlers = (socket) => {
  socket.on("subscribeToRide", (rideId) => {
    if (!rideId) return;
    const room = `ride_${rideId}`;
    socket.join(room);
    console.log(`[socket] ${socket.id} subscribed to ${room}`);
  });

  socket.on("driverLocationUpdate", ({ rideId, location }) => {
    if (!rideId || !location) return;
    const room = `ride_${rideId}`;
    socket.to(room).emit("driverLocationUpdate", { rideId, location });
    console.log(`[socket] location update ride=${rideId}`, location);
  });
};

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[socket] connected: ${socket.id}`);
    registerTrackingHandlers(socket);

    socket.on("disconnect", () => {
      console.log(`[socket] disconnected: ${socket.id}`);
    });
  });
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};
