import api from './api';

export const registerDriver = async (driverData) => {
    try {
        // Transform field names to match backend
        const backendData = {
            email: driverData.email,
            password: driverData.password,
            confirmPassword: driverData.confirmPassword,
            prenom: driverData.firstName,  // frontend -> backend
            nom: driverData.familyName,     // frontend -> backend
            age: parseInt(driverData.age),
            numTel: driverData.phoneNumber,
            sexe: driverData.sexe
        };
        
        const response = await api.post('/auth/driver/register', backendData);
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const registerPassenger = async (passengerData) => {
    try {
        // Transform field names to match backend
        const backendData = {
            email: passengerData.email,
            password: passengerData.password,
            confirmPassword: passengerData.confirmPassword,
            prenom: passengerData.firstName,  // frontend -> backend
            nom: passengerData.familyName,     // frontend -> backend
            age: parseInt(passengerData.age),
            numTel: passengerData.phoneNumber
        };
        
        const response = await api.post('/auth/passenger/register', backendData);
        return response.data;
    } catch (error) {
        throw error;
    }
}