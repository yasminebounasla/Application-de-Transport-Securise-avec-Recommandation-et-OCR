import { prisma } from "../config/prisma.js";
import bcrypt from 'bcrypt';

const PRENOMS_F = ["Sara", "Lina", "Amira", "Nour", "Yasmine", "Fatima", "Meriem", "Salma", "Rania", "Asma"];
const PRENOMS_M = ["Ahmed", "Mohamed", "Yassine", "Karim", "Mehdi", "Hamza", "Rami", "Khaled", "Sofiane", "Amine"];
const NOMS = ["Benali", "Mansouri", "Bouzid", "Belkacem", "Haddad", "Amrani", "Slimani", "Meziane", "Bouaziz", "Cherif"];

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomBool = () => Math.random() > 0.5;
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function seedDrivers(count = 30) {
    console.log(`Création de ${count} drivers...\n`);
    
    const hashedPassword = await bcrypt.hash("Test123!", 10);
    
    const drivers = [];
    
    for (let i = 1; i <= count; i++) {
        const sexe = i % 2 === 0 ? "F" : "M";  // Alterne F/M
        const prenom = randomChoice(sexe === "F" ? PRENOMS_F : PRENOMS_M);
        const nom = randomChoice(NOMS);
        
        drivers.push({
            email: `driver${i}@mail.com`,
            password: hashedPassword,
            nom: nom,
            prenom: prenom,
            numTel: `0${randomInt(500000000, 799999999)}`,
            sexe: sexe,
            age: randomInt(22, 55),
            fumeur: randomBool(),
            talkative: randomBool(),
            radio_on: randomBool(),
            smoking_allowed: randomBool(),
            pets_allowed: randomBool(),
            car_big: randomBool(),
            works_morning: randomBool(),
            works_afternoon: randomBool(),
            works_evening: randomBool(),
            works_night: randomBool(),
            isVerified: true
        });
    }
    
    try {
        const result = await prisma.driver.createMany({
            data: drivers,
            skipDuplicates: true  // Ignore les emails en double
        });
        
        console.log(` ${result.count} drivers créés avec succès!\n`);
        
        // Affiche quelques exemples
        const created = await prisma.driver.findMany({ take: 5 });
        console.log(" Exemples de drivers créés:");
        created.forEach(d => {
            console.log(`  - ${d.prenom} ${d.nom} (${d.sexe}) - talkative: ${d.talkative}, pets: ${d.pets_allowed}`);
        });
        
    } catch (error) {
        console.error("Erreur:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}

// Lance le script
seedDrivers(30);  // Change le nombre si tu veux