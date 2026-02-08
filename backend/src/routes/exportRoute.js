import express from "express";
import { exportLightFM } from "../services/exportDataService.js";

const router = express.Router();

router.get("/", exportLightFM);
export default router;
