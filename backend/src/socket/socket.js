import { Server } from "socket.io";
import { registerTrackingHandlers } from "./tracking.js";

let io; // variable globale pour utilisér l'instance de Socket.IO dans d'autres modules

export const initSocket = (httpServer) => {

    //créer une instance de socket.io
    io = new Server(httpServer, {
        cors: { origin: process.env.FRONTEND_URL }, 
    });

    io.on("connection", (socket) => {
        console.log("🔌 Client connecté :", socket.id);

        // écoute de l'événement d'inscription de l'utilisateur
        socket.on("registerUser", (userId) => {

            //récupéré le id de l'utilisateur et le stocké dans la session du socket
            socket.join(userId);
            console.log(`✅ User ${userId} joined room`);
        });

        // attach tracking-specific listeners (ride subscription and
        // location broadcasts)
        registerTrackingHandlers(socket);

        socket.on("disconnect", () => {
            console.log("❌ Client déconnecté :", socket.id);
        });
    });

    return io;
};

// fonction pour récupérer l'instance de io dans les autres modules
export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};