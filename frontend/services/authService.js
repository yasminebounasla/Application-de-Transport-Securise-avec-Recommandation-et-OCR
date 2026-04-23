import axios from 'axios';
import { API_URL } from './api';
import {
  buildInternationalPhoneNumber,
  getCountryPhoneOption,
} from '../utils/phoneNumber';

export const registerDriver = async (driverData) => {
  const selectedCountry = getCountryPhoneOption(driverData.phoneCountryCode);
  const backendData = {
    email: driverData.email,
    password: driverData.password,
    confirmPassword: driverData.confirmPassword,
    prenom: driverData.firstName,
    nom: driverData.familyName,
    age: parseInt(driverData.age),
    numTel: buildInternationalPhoneNumber(driverData.phoneNumber, selectedCountry),
    sexe: driverData.sexe === "Male" ? "M" : "F",
  };
  const response = await axios.post(`${API_URL}/auth/driver/register`, backendData);
  return response;
};

export const registerPassenger = async (passengerData) => {
  const selectedCountry = getCountryPhoneOption(passengerData.phoneCountryCode);
  const backendData = {
    email: passengerData.email,
    password: passengerData.password,
    confirmPassword: passengerData.confirmPassword,
    prenom: passengerData.firstName,
    nom: passengerData.familyName,
    age: parseInt(passengerData.age),
    numTel: buildInternationalPhoneNumber(passengerData.phoneNumber, selectedCountry),
    sexe: passengerData.sexe === "Male" ? "M" : "F",
  };
  const response = await axios.post(`${API_URL}/auth/passenger/register`, backendData);
  return response;
};

export const loginDriver = async (driverData) => {
  const response = await axios.post(`${API_URL}/auth/driver/login`, {
    email: driverData.email,
    password: driverData.password,
  });
  return response;
};

export const validateDriverLogin = async (driverData) => {
  const response = await axios.post(`${API_URL}/auth/driver/validate-login`, {
    email: driverData.email,
    password: driverData.password,
  });
  return response;
};

export const loginPassenger = async (passengerData) => {
  const response = await axios.post(`${API_URL}/auth/passenger/login`, {
    email: passengerData.email,
    password: passengerData.password,
  });
  return response;
};

export const validatePassengerLogin = async (passengerData) => {
  const response = await axios.post(`${API_URL}/auth/passenger/validate-login`, {
    email: passengerData.email,
    password: passengerData.password,
  });
  return response;
};
