import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET;

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "not authorized, missing token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, jwtSecret);

    // on stocke l'ID correspondant selon le type
    req.user = {
      driverId: decoded.driverId || null,
      passengerId: decoded.passengerId || null,
      name: decoded.name || null
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
