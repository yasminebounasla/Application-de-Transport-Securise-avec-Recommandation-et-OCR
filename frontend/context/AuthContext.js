import React, { createContext, useState, useEffect, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loginDriver,
  loginPassenger,
  registerDriver,
  registerPassenger,
} from "../services/authService";

const AuthContext = createContext();

const decodeJWT = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      // eslint-disable-next-line no-undef
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.log("Error decoding JWT:", error);
    return null;
  }
};

const isTokenExpired = (token) => {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;
  return decoded.exp * 1000 < Date.now();
};

const getAuthErrorMessage = (error, fallbackMessage) =>
  error.response?.data?.message || error.message || fallbackMessage;

const logUnexpectedAuthError = (context, error) => {
  const status = error?.response?.status;

  if (status && status < 500) {
    return;
  }

  console.error(context, error);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); // pour checkAuth


  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const storedUser = await AsyncStorage.getItem("user");

      if (
        token &&
        token.trim() !== "" &&
        token !== "null" &&
        token !== "undefined"
      ) {
        if (isTokenExpired(token)) {
          await AsyncStorage.removeItem("token");
          await AsyncStorage.removeItem("user");
          setUser(null);
          return;
        }
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } else {
        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("user");
        setUser(null);
      }
    } catch (error) {
      console.log("Error checking authentication:", error);
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
      setUser(null);
    } finally {
      setInitialLoading(false);
    }
  };

  const loginAsDriver = async (email, password) => {
    setLoading(true);
    try {
      const response = await loginDriver({ email, password });
      const responseData = response.data.data || response.data;
      // newww
      const { driver, accessToken, refreshToken } = responseData;
      if (!accessToken) throw new Error("No token received from server");
      await AsyncStorage.setItem("token", accessToken);
      await AsyncStorage.setItem("refreshToken", refreshToken);
      await AsyncStorage.setItem("userType", "driver");

      const userInfo = {
        id: driver.id,
        // ✅ AJOUT: driverId explicite
        // POURQUOI: NotificationContext.tsx fait newSocket.emit('registerDriver', user.driverId)
        //           Le backend socket.js fait socket.join(`driver_${driverId}`)
        //           Et les notifications sont envoyées via io.to(`driver_${driver.id}`)
        //           → user.id et driver.id sont le même ici, mais on l'expose
        //           explicitement pour que le code socket soit clair et sans ambiguïté.
        driverId: driver.id,
        firstName: driver.prenom,
        familyName: driver.nom,
        sexe: driver.sexe,
        age: driver.age,
        numTel: driver.numTel,
        email: driver.email,
        role: "driver",
        isVerified: driver.isVerified,
      };

      await AsyncStorage.setItem("user", JSON.stringify(userInfo));
      setUser(userInfo);

      return { success: true };
    } catch (err) {
      logUnexpectedAuthError("Driver login error:", err);
      return {
        success: false,
        message: getAuthErrorMessage(err, "Login failed"),
      };
    } finally {
      setLoading(false);
    }
  };

  const loginAsPassenger = async (email, password) => {
    setLoading(true);
    try {
      const response = await loginPassenger({ email, password });
      const responseData = response.data.data || response.data;
      // neww
      const { passenger, accessToken, refreshToken } = responseData;
      if (!accessToken) throw new Error("No token received from server");
      await AsyncStorage.setItem("token", accessToken);
      await AsyncStorage.setItem("refreshToken", refreshToken);
      await AsyncStorage.setItem("userType", "passenger");

      const userInfo = {
        id: passenger.id,
        // ✅ AJOUT: passengerId explicite
        // POURQUOI: NotificationContext.tsx fait newSocket.emit('registerUser', user.passengerId)
        //           Le backend socket.js fait socket.join(`passenger_${userId}`)
        //           Et rideController.js notifie via io.to(`passenger_${updatedRide.passenger.id}`)
        //           → sans passengerId ici, user.passengerId était undefined
        //           → le passager rejoignait la room "passenger_undefined" → aucune notif reçue.
        passengerId: passenger.id,
        firstName: passenger.prenom,
        familyName: passenger.nom,
        sexe: passenger.sexe,
        age: passenger.age,
        numTel: passenger.numTel,
        email: passenger.email,
        role: "passenger",
      };

      await AsyncStorage.setItem("user", JSON.stringify(userInfo));
      setUser(userInfo);

      return { success: true };
    } catch (error) {
      logUnexpectedAuthError("Passenger login error:", error);
      return {
        success: false,
        message: getAuthErrorMessage(error, "Login failed"),
      };
    } finally {
      setLoading(false);
    }
  };

  const registerAsDriver = async (driverData) => {
    setLoading(true);
    try {
      const response = await registerDriver(driverData);
      const responseData = response.data.data || response.data;
      const { newDriver, accessToken, refreshToken } = responseData;

      if (!accessToken) throw new Error("No token received from server");
      if (!newDriver) throw new Error("No driver data received from server");

      await AsyncStorage.setItem("token", accessToken);
      await AsyncStorage.setItem("refreshToken", refreshToken);
      await AsyncStorage.setItem("userType", "driver");

      const driverInfo = {
        id: newDriver.id,
        // ✅ AJOUT: driverId dès l'inscription
        driverId: newDriver.id,
        firstName: newDriver.prenom,
        familyName: newDriver.nom,
        age: newDriver.age,
        numTel: newDriver.numTel,
        sexe: newDriver.sexe,
        email: newDriver.email,
        role: "driver",
        isVerified: newDriver.isVerified || false,
      };

      await AsyncStorage.setItem("user", JSON.stringify(driverInfo));
      setUser(driverInfo);

      return { success: true, token: accessToken };
    } catch (err) {
      console.log("Registration error:", err);
      return {
        success: false,
        message:
          err.response?.data?.message || err.message || "Registration failed",
      };
    } finally {
      setLoading(false);
    }
  };

  const registerAsPassenger = async (userData) => {
    setLoading(true);
    try {
      const response = await registerPassenger(userData);
      console.log("REGISTER RESPONSE:", JSON.stringify(response.data)); // ADD THIS

      const responseData = response.data.data || response.data;
      const { passenger: newPassenger, accessToken, refreshToken } = responseData;
      if (!accessToken) throw new Error("No token received from server");
      if (!newPassenger)
        throw new Error("No passenger data received from server");

      await AsyncStorage.setItem("token", accessToken);
      await AsyncStorage.setItem("refreshToken", refreshToken);
      await AsyncStorage.setItem("userType", "passenger");

      const userInfo = {
        id: newPassenger.id,
        // ✅ AJOUT: passengerId dès l'inscription
        passengerId: newPassenger.id,
        firstName: newPassenger.prenom,
        familyName: newPassenger.nom,
        sexe: newPassenger.sexe,
        email: newPassenger.email,
        age: newPassenger.age,
        numTel: newPassenger.numTel,
        role: "passenger",
      };

      await AsyncStorage.setItem("user", JSON.stringify(userInfo));
      setUser(userInfo);

      return { success: true };
    } catch (err) {
      console.log("Registration error:", err);
      return {
        success: false,
        message:
          err.response?.data?.message || err.message || "Registration failed",
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("refreshToken");
      await AsyncStorage.removeItem("userType");
      await AsyncStorage.removeItem("user");
      setUser(null);
    } catch (error) {
      console.log("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        initialLoading,
        loginAsDriver,
        loginAsPassenger,
        registerAsDriver,
        registerAsPassenger,
        logout,

        isAuthenticated:
          !!user && (user.role === "passenger" || user.isVerified === true),
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
