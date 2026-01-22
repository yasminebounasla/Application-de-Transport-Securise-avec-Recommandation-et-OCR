import { Button } from 'react-native';
import { View, Text, TextInput } from 'react-native';
import { useState } from 'react';
import { Stack } from 'expo-router';
import { registerDriver } from '../../services/authService';

export default function RegisterDriverScreen() {

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [familyName, setFamilyName] = useState('');
    const [age, setAge] = useState('');
    const [sexe, setSexe] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [error, setError] = useState('');

    const handleRegister = async () => {
    try {
        const data = await registerDriver({
            email,
            password,
            confirmPassword,
            firstName,
            familyName,
            age,
            sexe,
            phoneNumber
        });
        console.log('Registration successful:', data);
    } catch (error: any) {
        setError(
            error.response?.data?.message || 'Something went wrong'
        );
    }
}


    return (
        <View>
        <Stack.Screen options={{ title: 'Register Driver' }} />
        <View>
            <Text>email</Text>
            <TextInput value={email} onChangeText={setEmail} placeholder='Email'/>

            <Text>password</Text>
            <TextInput value={password} onChangeText={setPassword} placeholder='Password' secureTextEntry/>

            <Text>confirm password</Text>
            <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder='Confirm Password' secureTextEntry/>

            <Text>first name</Text>
            <TextInput value={firstName} onChangeText={setFirstName} placeholder='First Name'/>

            <Text>family name</Text>  
            <TextInput value={familyName} onChangeText={setFamilyName} placeholder='Family Name'/>

            <Text>age</Text>
            <TextInput value={age} onChangeText={setAge} placeholder='Age' keyboardType='numeric'/>

            <Text>sexe</Text>
            <TextInput value={sexe} onChangeText={setSexe} placeholder='Sexe'/>

            <Text>phone number</Text>
            <TextInput value={phoneNumber} onChangeText={setPhoneNumber} placeholder='Phone Number' keyboardType='phone-pad'/>

            <Text>Register Button</Text>
            <Button
                title="Next"
                onPress={handleRegister}
            />

            <Text>{error}</Text>

        </View>
        </View>
    );
}
