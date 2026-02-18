import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginDriver, loginPassenger, registerDriver, registerPassenger } from '../services/authService';

const AuthContext = createContext();

// Décoder le JWT
const decodeJWT = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

// Vérifier si le token est expiré
const isTokenExpired = (token) => {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;
  return decoded.exp * 1000 < Date.now();
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (token && token.trim() !== "" && token !== "null" && token !== "undefined") {
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
      console.error("Error checking authentication:", error);
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loginAsDriver = async (email, password) => {
    setLoading(true);
    try {
      const response = await loginDriver({ email, password });
      const responseData = response.data.data || response.data;
      const { driver, token } = responseData;
      
      if (!token) throw new Error('No token received from server');
      
      await AsyncStorage.setItem("token", token);

      const userInfo = {
        id: driver.id,
        firstName: driver.prenom,
        familyName: driver.nom,
        sexe: driver.sexe,
        age: driver.age,
        numTel: driver.numTel,
        email: driver.email,
        role: 'driver'
      };

      await AsyncStorage.setItem("user", JSON.stringify(userInfo));
      setUser(userInfo);
      
      return { success: true };
    } catch (err) {
      console.error("Login error:", err);
      return { 
        success: false, 
        message: err.response?.data?.message || err.message || "Login failed" 
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
      const { passenger, token } = responseData;
      
      if (!token) throw new Error('No token received from server');
      
      await AsyncStorage.setItem("token", token);
      
      const userInfo = {
        id: passenger.id,
        firstName: passenger.prenom,  
        familyName: passenger.nom,
        age: passenger.age,
        numTel: passenger.numTel,
        email: passenger.email,
        role: 'passenger'
      };
      
      await AsyncStorage.setItem("user", JSON.stringify(userInfo));
      setUser(userInfo);
      
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Login failed' 
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
      const { newDriver, token } = responseData;
      
      if (!token) throw new Error('No token received from server');
      if (!newDriver) throw new Error('No driver data received from server');
      
      await AsyncStorage.setItem("token", token);
      
      const driverInfo = {
        id: newDriver.id,
        firstName: newDriver.prenom,
        familyName: newDriver.nom,
        age: newDriver.age,
        numTel: newDriver.numTel,
        sexe: newDriver.sexe,
        email: newDriver.email,
        role: 'driver'
      };

      await AsyncStorage.setItem("user", JSON.stringify(driverInfo));
      setUser(driverInfo);
      
      return { success: true };
    } catch (err) {
      console.error("Registration error:", err);
      return { 
        success: false, 
        message: err.response?.data?.message || err.message || "Registration failed" 
      };
    } finally {
      setLoading(false);
    }
  };

  const registerAsPassenger = async (userData) => {
    setLoading(true);
    try {
      const response = await registerPassenger(userData);
      const responseData = response.data.data || response.data;
      const { newPassenger, token } = responseData;
      
      if (!token) throw new Error('No token received from server');
      if (!newPassenger) throw new Error('No passenger data received from server');
      
      await AsyncStorage.setItem("token", token);
      
      const userInfo = {
        id: newPassenger.id,
        firstName: newPassenger.prenom,
        familyName: newPassenger.nom,
        email: newPassenger.email,
        age: newPassenger.age,
        numTel: newPassenger.numTel,
        role: 'passenger'
      };
      
      await AsyncStorage.setItem("user", JSON.stringify(userInfo));
      setUser(userInfo);
      
      return { success: true };
    } catch (err) {
      console.error("Registration error:", err);
      return { 
        success: false, 
        message: err.response?.data?.message || err.message || "Registration failed" 
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      loginAsDriver,
      loginAsPassenger,
      registerAsDriver,
      registerAsPassenger,
      logout,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};