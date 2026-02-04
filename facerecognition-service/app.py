#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
============================================================================
FACE RECOGNITION SERVICE - API
============================================================================
API REST pour la comparaison faciale permis vs selfie
"""

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
    license_image: UploadFile = File(..., description="Image du permis de conduire"),
    selfie_image: UploadFile = File(..., description="Image du selfie")
):
    """
    Compare un permis de conduire avec un selfie
    
    ### Paramètres:
    - **license_image**: Image du permis de conduire (JPEG, PNG)
    - **selfie_image**: Image du selfie (JPEG, PNG)
    
    ### Retourne:
    - Résultat de la comparaison avec verdict (verified: true/false)
    - Métriques détaillées (similarité, distance, seuil adaptatif)
    - Données d'analyse pour chaque visage
    
    ### Exemple d'utilisation:
    ```python
    import requests
    
    files = {
        'license_image': open('permis.jpg', 'rb'),
        'selfie_image': open('selfie.jpg', 'rb')
    }
    response = requests.post('http://localhost:8001/compare', files=files)
    result = response.json()
    print(f"Verified: {result['verified']}")
    ```
    """
    if not face_engine:
        raise HTTPException(status_code=503, detail="Face engine not initialized")
    
    # Validation des formats
    allowed_formats = ["image/jpeg", "image/png", "image/jpg"]
    
    if license_image.content_type not in allowed_formats:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid license image format. Allowed: {allowed_formats}"
        )
    
    if selfie_image.content_type not in allowed_formats:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid selfie image format. Allowed: {allowed_formats}"
        )
    
    # Sauvegarder temporairement les images
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    license_filename = f"license_{timestamp}.jpg"
    selfie_filename = f"selfie_{timestamp}.jpg"
    
    license_path = os.path.join(settings.LICENSE_DIR, license_filename)
    selfie_path = os.path.join(settings.SELFIE_DIR, selfie_filename)
    
    try:
        # Sauvegarder les fichiers
        with open(license_path, "wb") as buffer:
            shutil.copyfileobj(license_image.file, buffer)
        
        with open(selfie_path, "wb") as buffer:
            shutil.copyfileobj(selfie_image.file, buffer)
        
        logger.info(f"📂 Saved files: {license_filename}, {selfie_filename}")
        
        # Comparaison
        result = face_engine.compare_faces(license_path, selfie_path)
        
        return JSONResponse(content=result)
    
    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        logger.error(f"Comparison error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
    
    finally:
        # Nettoyage optionnel (décommenter pour supprimer après traitement)
        # if os.path.exists(license_path):
        #     os.remove(license_path)
        # if os.path.exists(selfie_path):
        #     os.remove(selfie_path)
        pass


@app.post("/compare-with-stored-license")
async def compare_with_stored_license(
    user_id: str,
    selfie_image: UploadFile = File(..., description="Image du selfie")
):
    """
    Compare un selfie avec un permis déjà stocké en base de données
    
    ### Usage en production:
    1. Le permis est uploadé lors de l'inscription et stocké
    2. L'utilisateur prend un selfie en temps réel
    3. Cette API compare le selfie avec le permis stocké
    
    ### Paramètres:
    - **user_id**: ID de l'utilisateur (pour récupérer le permis)
    - **selfie_image**: Image du selfie en temps réel
    
    ### Note:
    Cette implémentation suppose que le permis est stocké comme:
    `data/license_images/user_{user_id}.jpg`
    
    En production, vous récupéreriez le chemin depuis votre base de données.
    """
    if not face_engine:
        raise HTTPException(status_code=503, detail="Face engine not initialized")
    
    # Récupérer le chemin du permis stocké
    # EN PRODUCTION: Récupérer depuis votre base de données
    license_path = os.path.join(settings.LICENSE_DIR, f"user_{user_id}.jpg")
    
    if not os.path.exists(license_path):
        raise HTTPException(
            status_code=404,
            detail=f"License not found for user {user_id}"
        )
    
    # Sauvegarder temporairement le selfie
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    selfie_filename = f"selfie_{user_id}_{timestamp}.jpg"
    selfie_path = os.path.join(settings.SELFIE_DIR, selfie_filename)
    
    try:
        with open(selfie_path, "wb") as buffer:
            shutil.copyfileobj(selfie_image.file, buffer)
        
        logger.info(f"📂 Comparing with stored license for user {user_id}")
        
        # Comparaison
        result = face_engine.compare_faces(license_path, selfie_path)
        
        return JSONResponse(content=result)
    
    except Exception as e:
        logger.error(f"Comparison error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
    
    finally:
        # Nettoyage du selfie temporaire
        if os.path.exists(selfie_path):
            os.remove(selfie_path)


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
