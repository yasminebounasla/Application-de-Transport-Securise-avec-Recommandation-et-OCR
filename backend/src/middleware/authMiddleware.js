import jwt from "jsonwebtoken";


export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "not authorized, missing token" });
  }

  const token = authHeader.split(" ")[1];

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
     driverId: decoded.driverId || decoded.id || null,
     passengerId: decoded.passengerId || null,
     name: decoded.name || null
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
