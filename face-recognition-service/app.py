#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
============================================================================
FACE RECOGNITION SERVICE - API
============================================================================
API REST pour la comparaison faciale permis vs selfie
"""
import cv2
import numpy as np

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import shutil
from pathlib import Path
from datetime import datetime
from loguru import logger
import sys

from config import settings
from face_comparison import FaceComparisonEngine

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================
logger.remove()
logger.add(
    sys.stderr,
    format=settings.LOG_FORMAT,
    level=settings.LOG_LEVEL
)

# ============================================================================
# FASTAPI APP
# ============================================================================
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description=settings.API_DESCRIPTION
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # À restreindre en production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# GLOBAL INSTANCES
# ============================================================================
face_engine: Optional[FaceComparisonEngine] = None


# ============================================================================
# MODELS
# ============================================================================
class ComparisonResult(BaseModel):
    """Modèle de réponse pour la comparaison"""
    verified: bool
    similarity: float
    distance: float
    similarity_percentage: float
    threshold: float
    margin: float
    verdict: str
    confidence: str
    color: str
    license_data: dict
    selfie_data: dict
    adjustments: list


class HealthResponse(BaseModel):
    """Modèle de réponse pour le health check"""
    status: str
    service: str
    version: str


# ============================================================================
# STARTUP / SHUTDOWN
# ============================================================================
@app.on_event("startup")
async def startup_event():
    """Initialisation au démarrage"""
    global face_engine
    
    logger.info("🚀 Starting Face Recognition Service...")
    
    # Créer les dossiers nécessaires
    Path(settings.LICENSE_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.SELFIE_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    
    # Initialiser le moteur de comparaison
    try:
        face_engine = FaceComparisonEngine()
        logger.info("✅ Face Recognition Service started successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize face engine: {e}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Nettoyage à l'arrêt"""
    logger.info("🛑 Shutting down Face Recognition Service...")


# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/", response_model=HealthResponse)
async def root():
    """
    Root endpoint - Health check
    """
    return {
        "status": "online",
        "service": settings.API_TITLE,
        "version": settings.API_VERSION
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    """
    return {
        "status": "healthy" if face_engine else "unhealthy",
        "service": settings.API_TITLE,
        "version": settings.API_VERSION
    }


@app.post("/compare", response_model=ComparisonResult)
async def compare_faces(
    license_image: UploadFile = File(...),
    selfie_image: UploadFile = File(...)
):
    if not face_engine:
        raise HTTPException(status_code=503, detail="Face engine not initialized")

    allowed_formats = ["image/jpeg", "image/png", "image/jpg"]
    if license_image.content_type not in allowed_formats:
        raise HTTPException(status_code=400, detail="Format permis invalide")
    if selfie_image.content_type not in allowed_formats:
        raise HTTPException(status_code=400, detail="Format selfie invalide")

    # ✅ PERMIS — traitement en mémoire uniquement, jamais sur disque
    license_bytes = await license_image.read()
    license_array = np.frombuffer(license_bytes, np.uint8)
    img_license = cv2.imdecode(license_array, cv2.IMREAD_COLOR)
    if img_license is None:
        raise HTTPException(status_code=400, detail="Image permis invalide")

    # ✅ SELFIE — sauvegardé sur disque pour le profil
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    selfie_filename = f"selfie_{timestamp}.jpg"
    selfie_path = os.path.join(settings.SELFIE_DIR, selfie_filename)

    try:
        selfie_bytes = await selfie_image.read()
        with open(selfie_path, "wb") as f:
            f.write(selfie_bytes)

        logger.info(f"✅ Selfie sauvegardé: {selfie_filename}")
        logger.info(f"🔒 Permis traité en mémoire — non sauvegardé")

        result = face_engine.compare_faces_from_arrays(img_license, selfie_path)

        # Ajouter le chemin du selfie dans le résultat
        result["selfie_path"] = selfie_filename

        return JSONResponse(content=result)

    except ValueError as e:
        # Si la comparaison échoue, supprimer le selfie
        if os.path.exists(selfie_path):
            os.remove(selfie_path)
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        if os.path.exists(selfie_path):
            os.remove(selfie_path)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# MAIN
# ============================================================================
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True,
        log_level=settings.LOG_LEVEL.lower()
    )
