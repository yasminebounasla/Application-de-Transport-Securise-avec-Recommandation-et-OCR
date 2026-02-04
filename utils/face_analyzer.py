#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
============================================================================
FACE ANALYZER - PRODUCTION GRADE
============================================================================
Analyse complète des visages avec détection de qualité, occlusion, etc.
"""

import cv2
import numpy as np
from typing import Dict, Tuple, Optional
from loguru import logger


class FaceAnalyzer:
    """Analyseur de visages avec métriques de qualité"""
    
    @staticmethod
    def analyze_face_quality(face, img: np.ndarray) -> Dict:
        """
        Analyse la qualité d'un visage détecté
        
        Args:
            face: Objet face d'InsightFace
            img: Image source (BGR)
            
        Returns:
            Dict avec métriques de qualité
        """
        bbox = face.bbox.astype(int)
        
        # ====================================================================
        # 1. TAILLE DU VISAGE
        # ====================================================================
        face_area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
        img_area = img.shape[0] * img.shape[1]
        size_ratio = face_area / img_area
        
        # ====================================================================
        # 2. NETTETÉ (SHARPNESS)
        # ====================================================================
        face_img = img[bbox[1]:bbox[3], bbox[0]:bbox[2]]
        
        if face_img.size > 0:
            gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)
            laplacian = cv2.Laplacian(gray, cv2.CV_64F).var()
            sharpness_score = min(100, (laplacian / 500) * 100)
        else:
            sharpness_score = 50
            logger.warning("Face region empty, defaulting sharpness to 50")
        
        # ====================================================================
        # 3. SCORE DE QUALITÉ COMPOSITE
        # ====================================================================
        # Formule: 40% détection + 30% taille + 30% netteté
        quality_score = (
            face.det_score * 40 +
            size_ratio * 200 +
            sharpness_score * 0.6
        )
        quality_score = min(100, quality_score)
        
        # Catégorisation
        if quality_score >= 70:
            quality_cat = "EXCELLENT"
        elif quality_score >= 50:
            quality_cat = "BON"
        elif quality_score >= 30:
            quality_cat = "MOYEN"
        else:
            quality_cat = "FAIBLE"
        
        return {
            "quality_score": quality_score,
            "quality_category": quality_cat,
            "sharpness": sharpness_score,
            "size_ratio": size_ratio,
            "det_score": face.det_score,
            "face_area": face_area
        }
    
    @staticmethod
    def detect_occlusion(img: np.ndarray, bbox: np.ndarray) -> str:
        """
        Détecte le niveau d'occlusion (hijab, etc.)
        
        Args:
            img: Image BGR
            bbox: Bounding box du visage
            
        Returns:
            "none", "moderate", ou "heavy"
        """
        h, w = img.shape[:2]
        
        # Régions d'intérêt
        center_region = img[int(h*0.4):int(h*0.6), int(w*0.4):int(w*0.6)]
        top_region = img[:int(h*0.2), :]
        
        # Analyse de luminosité
        center_brightness = np.mean(cv2.cvtColor(center_region, cv2.COLOR_BGR2GRAY))
        periph_brightness = np.mean(cv2.cvtColor(top_region, cv2.COLOR_BGR2GRAY))
        brightness_diff = abs(center_brightness - periph_brightness)
        
        # Ratio de taille du visage
        face_area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
        img_area = h * w
        size_ratio = face_area / img_area
        
        # Décision
        if brightness_diff > 50 or size_ratio < 0.15:
            return "heavy"
        elif brightness_diff > 30 or size_ratio < 0.20:
            return "moderate"
        else:
            return "none"
    
    @staticmethod
    def extract_face_attributes(face) -> Dict:
        """
        Extrait les attributs du visage (âge, genre)
        
        Args:
            face: Objet face d'InsightFace
            
        Returns:
            Dict avec attributs
        """
        age = int(face.age) if hasattr(face, 'age') else None
        gender = "M" if (hasattr(face, 'gender') and face.gender == 1) else "F"
        
        return {
            "age": age,
            "gender": gender
        }
    
    @staticmethod
    def compute_similarity(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """
        Calcule la similarité cosine entre deux embeddings
        
        Args:
            embedding1: Premier embedding normalisé
            embedding2: Deuxième embedding normalisé
            
        Returns:
            Similarité entre -1 et 1 (1 = identique)
        """
        similarity = np.dot(embedding1, embedding2)
        return float(similarity)
    
    @staticmethod
    def compute_distance(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """
        Calcule la distance euclidienne entre deux embeddings
        
        Args:
            embedding1: Premier embedding normalisé
            embedding2: Deuxième embedding normalisé
            
        Returns:
            Distance (0 = identique, plus grand = différent)
        """
        similarity = FaceAnalyzer.compute_similarity(embedding1, embedding2)
        distance = 1.0 - similarity
        return distance
    
    @staticmethod
    def rotate_image(img: np.ndarray, angle: int) -> np.ndarray:
        """
        Applique une rotation à une image
        
        Args:
            img: Image à tourner
            angle: 0, 90, 180, ou 270 degrés
            
        Returns:
            Image tournée
        """
        if angle == 0:
            return img
        elif angle == 90:
            return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
        elif angle == 180:
            return cv2.rotate(img, cv2.ROTATE_180)
        elif angle == 270:
            return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
        else:
            raise ValueError(f"Invalid rotation angle: {angle}")
    
    @staticmethod
    def analyze_complete_face(face, img: np.ndarray, rotation_angle: int = 0) -> Dict:
        """
        Analyse complète d'un visage
        
        Args:
            face: Objet face d'InsightFace
            img: Image source
            rotation_angle: Angle de rotation appliqué
            
        Returns:
            Dict avec toutes les métriques
        """
        bbox = face.bbox.astype(int)
        
        # Qualité
        quality_data = FaceAnalyzer.analyze_face_quality(face, img)
        
        # Occlusion
        occlusion_level = FaceAnalyzer.detect_occlusion(img, bbox)
        
        # Attributs
        attributes = FaceAnalyzer.extract_face_attributes(face)
        
        # Image du visage
        face_img = img[bbox[1]:bbox[3], bbox[0]:bbox[2]]
        
        return {
            "embedding": face.normed_embedding,
            "bbox": bbox.tolist(),
            "rotation": rotation_angle,
            "occlusion_level": occlusion_level,
            "face_img": face_img,
            **quality_data,
            **attributes
        }
