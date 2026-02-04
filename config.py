#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
============================================================================
FACE RECOGNITION SERVICE - CONFIGURATION
============================================================================
Configuration centralisée pour le service de reconnaissance faciale
"""

from pydantic_settings import BaseSettings
from typing import Dict


class Settings(BaseSettings):
    """Configuration du service de reconnaissance faciale"""
    
    # ========================================================================
    # MODÈLE INSIGHTFACE
    # ========================================================================
    MODEL_PACK: str = "buffalo_l"  # Modèle haute précision
    DET_SIZE: tuple = (640, 640)   # Taille détection
    CTX_ID: int = 0                # CPU context (0) ou GPU (-1)
    
    # ========================================================================
    # SEUILS DE VALIDATION
    # ========================================================================
    THRESHOLDS: Dict[str, Dict[str, float]] = {
        "normal": {
            "value": 1.00,  # Distance euclidienne max pour validation
            "label": "NORMAL (KYC)"
        }
    }
    
    # ========================================================================
    # AJUSTEMENTS CONTEXTUELS
    # ========================================================================
    # Ces ajustements RÉDUISENT le seuil selon le contexte
    # (Plus le contexte est difficile, plus on est tolérant)
    CONTEXT_ADJUSTMENTS: Dict[str, float] = {
        "hijab_heavy": -0.20,      # Voile couvrant (visage très partiellement visible)
        "hijab_moderate": -0.12,   # Voile léger (visage majoritairement visible)
        "old_photo": -0.15,        # Photo ancienne/dégradée
        "low_quality": -0.12,      # Basse qualité d'image
        "age_gap": -0.10           # Écart d'âge important (>20 ans)
    }
    
    # ========================================================================
    # SEUILS DE QUALITÉ D'IMAGE
    # ========================================================================
    QUALITY_THRESHOLDS: Dict[str, float] = {
        "excellent": 70.0,
        "good": 50.0,
        "medium": 30.0
    }
    
    # ========================================================================
    # CHEMINS DE DONNÉES
    # ========================================================================
    DATA_DIR: str = "data"
    LICENSE_DIR: str = "data/license_images"
    SELFIE_DIR: str = "data/selfie_images"
    OUTPUT_DIR: str = "outputs"
    
    # ========================================================================
    # API CONFIGURATION
    # ========================================================================
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8001
    API_TITLE: str = "Face Recognition Service"
    API_VERSION: str = "1.0.0"
    API_DESCRIPTION: str = """
    Service de reconnaissance faciale pour validation KYC
    
    ### Fonctionnalités:
    - ✅ Comparaison permis de conduire vs selfie
    - 🔄 Rotation intelligente automatique
    - 🎯 Seuils adaptatifs selon contexte
    - 📊 Analyse de qualité d'image
    - 🧕 Détection occlusion (hijab, etc.)
    """
    
    # ========================================================================
    # LOGGING
    # ========================================================================
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Instance globale
settings = Settings()


# ============================================================================
# CONFIGURATION ROTATIONS
# ============================================================================
ROTATIONS = {
    0: "original",
    90: "90° clockwise",
    180: "180°",
    270: "270° clockwise"
}


# ============================================================================
# MESSAGES D'ERREUR
# ============================================================================
ERROR_MESSAGES = {
    "no_face_detected": "❌ Aucun visage détecté dans l'image",
    "multiple_faces": "❌ Plusieurs visages détectés (doit être 1 seul)",
    "low_quality": "⚠️ Qualité d'image insuffisante",
    "file_not_found": "❌ Fichier non trouvé",
    "invalid_format": "❌ Format d'image invalide",
    "rotation_failed": "❌ Échec de rotation d'image"
}


# ============================================================================
# VERDICT MAPPING
# ============================================================================
VERDICT_CONFIG = {
    "excellent": {
        "max_distance": 0.60,
        "label": "✅ MATCH EXCELLENT",
        "confidence": "TRÈS HAUTE",
        "color": "green"
    },
    "good": {
        "max_distance": 0.80,
        "label": "✅ MATCH BON",
        "confidence": "HAUTE",
        "color": "limegreen"
    },
    "acceptable": {
        "max_distance": 1.00,
        "label": "✅ MATCH ACCEPTABLE",
        "confidence": "MOYENNE",
        "color": "yellowgreen"
    },
    "limit": {
        "max_distance": float('inf'),
        "label": "✅ MATCH LIMITE",
        "confidence": "FAIBLE",
        "color": "orange"
    },
    "no_match_limit": {
        "max_distance": 1.50,
        "label": "❌ PAS DE MATCH (LIMITE)",
        "confidence": "FAIBLE",
        "color": "orangered"
    },
    "no_match": {
        "max_distance": float('inf'),
        "label": "❌ PAS DE MATCH",
        "confidence": "TRÈS FAIBLE",
        "color": "red"
    }
}
