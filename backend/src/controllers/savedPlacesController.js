import { prisma } from "../config/prisma.js";

// ── GET all saved places
export const getSavedPlaces = async (req, res) => {
  console.log('req.user:', req.user);
  const passengerId = req.user.passengerId;
  if (!passengerId) return res.status(403).json({ message: "Access restricted to passengers only." });

  try {
    const savedPlaces = await prisma.savedPlace.findMany({
      where: { passengerId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ message: "Saved places retrieved.", data: savedPlaces });
  } catch (err) {
    res.status(500).json({ message: "Failed to retrieve saved places.", error: err.message });
  }
};

// ── ADD a saved place
export const addSavedPlace = async (req, res) => {
  const passengerId = req.user.passengerId;
  if (!passengerId) return res.status(403).json({ message: "Access restricted to passengers only." });

  try {
    const { label, address, lat, lng } = req.body;

    if (!label || !address || lat === undefined || lng === undefined) {
      return res.status(400).json({ message: "label, address, lat and lng are required." });
    }

    const savedPlace = await prisma.savedPlace.create({
      data: {
        passengerId,
        label,
        address,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      },
    });

    res.status(201).json({ message: "Saved place added.", data: savedPlace });
  } catch (err) {
    res.status(500).json({ message: "Failed to add saved place.", error: err.message });
  }
};

// ── UPDATE a saved place
export const updateSavedPlace = async (req, res) => {
  const passengerId = req.user.passengerId;
  const { id } = req.params;
  if (!passengerId) return res.status(403).json({ message: "Access restricted to passengers only." });

  try {
    const existing = await prisma.savedPlace.findFirst({
      where: { id: parseInt(id), passengerId },
    });

    if (!existing) return res.status(404).json({ message: "Saved place not found." });

    const { label, address, lat, lng } = req.body;
    const updateData = {};
    if (label !== undefined)   updateData.label   = label;
    if (address !== undefined) updateData.address = address;
    if (lat !== undefined)     updateData.lat     = parseFloat(lat);
    if (lng !== undefined)     updateData.lng     = parseFloat(lng);

    const updated = await prisma.savedPlace.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    res.status(200).json({ message: "Saved place updated.", data: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to update saved place.", error: err.message });
  }
};

// ── DELETE a saved place
export const deleteSavedPlace = async (req, res) => {
  const passengerId = req.user.passengerId;
  const { id } = req.params;
  if (!passengerId) return res.status(403).json({ message: "Access restricted to passengers only." });

  try {
    const existing = await prisma.savedPlace.findFirst({
      where: { id: parseInt(id), passengerId },
    });

    if (!existing) return res.status(404).json({ message: "Saved place not found." });

    await prisma.savedPlace.delete({ where: { id: parseInt(id) } });

    res.status(200).json({ message: "Saved place deleted." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete saved place.", error: err.message });
  }
};