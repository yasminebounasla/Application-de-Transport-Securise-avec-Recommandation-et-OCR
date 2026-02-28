import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

type Notification = {
  title: string;
  message: string;
};

type NotificationContextType = {
  notifications: Notification[];
  socket: Socket | null;
};

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  socket: null,
});

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { user } = useAuth(); // ✅ On récupère le user (id + role)

  const addNotif = (title: string, message: string) => {
    setNotifications(prev => [{ title, message }, ...prev]);
  };

  useEffect(() => {
    // ✅ Si pas de user connecté, on ne connecte pas le socket
    if (!user || !user.id) return;

    const newSocket = io(process.env.EXPO_PUBLIC_API_URL_SANS_API!);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ Connecté à Socket.IO:', newSocket.id);

      // ✅ Enregistre dans la bonne room selon le rôle
      if (user.role === 'passenger') {
        newSocket.emit('registerUser', user.id);
        console.log('📢 Registered as passenger:', user.id);
      } else if (user.role === 'driver') {
        newSocket.emit('registerDriver', user.id);
        console.log('📢 Registered as driver:', user.id);
      }
    });

    // ✅ Events pour le PASSAGER
    newSocket.on('rideCreated', (data: any) => {
      console.log('rideCreated reçu:', data);
      addNotif('Trajet créé', `Votre trajet #${data.rideId} est en attente`);
    });

    newSocket.on('rideAccepted', (data: any) => {
      console.log('rideAccepted reçu:', data);
      addNotif('Trajet accepté 🎉', `${data.driver.prenom} a accepté votre trajet`);
    });

    newSocket.on('rideRejectedByDriver', (data: any) => {
      console.log('rideRejected reçu:', data);
      addNotif('Trajet refusé', `Le conducteur a refusé votre demande`);
    });

    // ✅ Events pour le DRIVER
    newSocket.on('rideCancelledByPassenger', (data: any) => {
      console.log('rideCancelled reçu:', data);
      addNotif('Trajet annulé', `${data.passenger.prenom} a annulé le trajet`);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Socket déconnecté');
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user]); // ✅ Se relance quand user change (login/logout)

  return (
    <NotificationContext.Provider value={{ notifications, socket }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);