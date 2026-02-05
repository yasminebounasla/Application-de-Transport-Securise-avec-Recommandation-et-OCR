import express from "express";
import { exportLightFM } from "../controllers/exportLightFM.js";

const router = express.Router();

router.get("/", exportLightFM);
export default router;
