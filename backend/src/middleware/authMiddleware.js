import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET;

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, missing token" });
  }
  
  const token = authHeader.split(" ")[1];
  
  try {
    const decoded = jwt.verify(token, jwtSecret);
    
    // Ajoute les informations de l'utilisateur décodé à la requête
    req.user = {
      passengerId: decoded.passengerId || null,
      driverId: decoded.driverId || null,
      name: decoded.name || null,
      email: decoded.email || null
    };
    
    next();
    
  } catch (err) {
    console.error('❌ Token invalide:', err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};