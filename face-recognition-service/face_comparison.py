#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
============================================================================
FACE COMPARISON ENGINE - PRODUCTION GRADE
============================================================================
Moteur de comparaison faciale avec rotation intelligente basée sur embeddings
"""

import cv2
import numpy as np
from typing import Dict, Tuple, List, Optional
from insightface.app import FaceAnalysis
from loguru import logger

from config import settings, VERDICT_CONFIG
from utils.face_analyzer import FaceAnalyzer


class FaceComparisonEngine:
    """Moteur de comparaison faciale avec rotation intelligente"""
    
    def __init__(self):
        """Initialise le modèle InsightFace"""
        logger.info(f"Initializing InsightFace model: {settings.MODEL_PACK}")
        
        self.app = FaceAnalysis(
            name=settings.MODEL_PACK,
            providers=['CPUExecutionProvider']
        )
        self.app.prepare(
            ctx_id=settings.CTX_ID,
            det_size=settings.DET_SIZE
        )
        
        self.analyzer = FaceAnalyzer()
        logger.info("✅ FaceComparisonEngine initialized successfully")
    
    def find_best_rotation_by_similarity(
        self,
        img1: np.ndarray,
        img2: np.ndarray
    ) -> Tuple[np.ndarray, int, Dict, np.ndarray, int, Dict, float]:
        """
        🔧 CORRECTION CRITIQUE:
        
        Trouve les meilleures rotations en comparant les EMBEDDINGS,
        pas juste le score de détection !
        
        Args:
            img1: Image permis (référence)
            img2: Image selfie (à tester rotations)
        
        Returns:
            (best_img1, angle1, face1_data, best_img2, angle2, face2_data, best_similarity)
        """
        logger.info("🔄 Testing intelligent rotations...")
        
        rotations = [0, 90, 180, 270]
        
        # ====================================================================
        # Test toutes rotations pour img1 (permis)
        # ====================================================================
        img1_results = []
        for angle in rotations:
            rotated = self.analyzer.rotate_image(img1.copy(), angle)
            faces = self.app.get(rotated)
            
            if len(faces) > 0:
                # Prendre le visage avec le meilleur score de détection
                face = sorted(faces, key=lambda x: x.det_score, reverse=True)[0]
                
                face_data = self.analyzer.analyze_complete_face(face, rotated, angle)
                img1_results.append({
                    "angle": angle,
                    "image": rotated,
                    "face_data": face_data,
                    "face": face
                })
                
                logger.debug(f"  License {angle:>3}° → Detection: {face.det_score*100:.1f}%")
        
        # ====================================================================
        # Test toutes rotations pour img2 (selfie)
        # ====================================================================
        img2_results = []
        for angle in rotations:
            rotated = self.analyzer.rotate_image(img2.copy(), angle)
            faces = self.app.get(rotated)
            
            if len(faces) > 0:
                face = sorted(faces, key=lambda x: x.det_score, reverse=True)[0]
                
                face_data = self.analyzer.analyze_complete_face(face, rotated, angle)
                img2_results.append({
                    "angle": angle,
                    "image": rotated,
                    "face_data": face_data,
                    "face": face
                })
                
                logger.debug(f"  Selfie {angle:>3}° → Detection: {face.det_score*100:.1f}%")
        
        if not img1_results or not img2_results:
            raise ValueError("❌ No face detected in one or both images")
        
        # ====================================================================
        # 🔧 CORRECTION: Comparer TOUS les embeddings
        # ====================================================================
        best_combo = None
        best_similarity = -2.0  # Minimum possible
        
        logger.info("\n📊 Comparing all rotation combinations:")
        for r1 in img1_results:
            for r2 in img2_results:
                # Similarité cosine
                similarity = self.analyzer.compute_similarity(
                    r1["face_data"]["embedding"],
                    r2["face_data"]["embedding"]
                )
                
                logger.info(
                    f"  License {r1['angle']:>3}° vs Selfie {r2['angle']:>3}° "
                    f"→ Similarity: {similarity*100:>5.1f}%"
                )
                
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_combo = (r1, r2)
        
        best_r1, best_r2 = best_combo
        
        logger.info(f"\n✅ BEST COMBINATION:")
        logger.info(f"  License: {best_r1['angle']}° (detection {best_r1['face'].det_score*100:.1f}%)")
        logger.info(f"  Selfie: {best_r2['angle']}° (detection {best_r2['face'].det_score*100:.1f}%)")
        logger.info(f"  Similarity: {best_similarity*100:.1f}%\n")
        
        return (
            best_r1["image"],
            best_r1["angle"],
            best_r1["face_data"],
            best_r2["image"],
            best_r2["angle"],
            best_r2["face_data"],
            best_similarity
        )
    
    def calculate_adaptive_threshold(
        self,
        face1_data: Dict,
        face2_data: Dict
    ) -> Tuple[float, List[Tuple[str, float]]]:
        """
        Calcule le seuil adaptatif selon le contexte
        
        Args:
            face1_data: Données du visage 1
            face2_data: Données du visage 2
            
        Returns:
            (threshold, adjustments_list)
        """
        base_threshold = settings.THRESHOLDS["normal"]["value"]
        current_threshold = base_threshold
        adjustments = []
        
        # ====================================================================
        # 1. QUALITÉ D'IMAGE
        # ====================================================================
        worst_quality = min(
            face1_data["quality_score"],
            face2_data["quality_score"]
        )
        
        if worst_quality < 50:
            adj = settings.CONTEXT_ADJUSTMENTS["low_quality"]
            adjustments.append(("Basse qualité", adj))
            current_threshold += adj
        
        # ====================================================================
        # 2. NETTETÉ (OLD PHOTO)
        # ====================================================================
        if face1_data["sharpness"] < 50 or face2_data["sharpness"] < 50:
            adj = settings.CONTEXT_ADJUSTMENTS["old_photo"]
            adjustments.append(("Photo ancienne/floue", adj))
            current_threshold += adj
        
        # ====================================================================
        # 3. OCCLUSION (HIJAB)
        # ====================================================================
        max_occlusion = max(
            face1_data["occlusion_level"],
            face2_data["occlusion_level"],
            key=lambda x: ["none", "moderate", "heavy"].index(x)
        )
        
        if max_occlusion == "heavy":
            adj = settings.CONTEXT_ADJUSTMENTS["hijab_heavy"]
            adjustments.append(("Occlusion lourde (hijab)", adj))
            current_threshold += adj
        elif max_occlusion == "moderate":
            adj = settings.CONTEXT_ADJUSTMENTS["hijab_moderate"]
            adjustments.append(("Occlusion modérée", adj))
            current_threshold += adj
        
        # ====================================================================
        # 4. ÉCART D'ÂGE
        # ====================================================================
        if face1_data["age"] and face2_data["age"]:
            age_gap = abs(face1_data["age"] - face2_data["age"])
            if age_gap > 20:
                adj = settings.CONTEXT_ADJUSTMENTS["age_gap"]
                adjustments.append((f"Écart d'âge ({age_gap} ans)", adj))
                current_threshold += adj
        
        logger.info(f"🎚️  Adaptive threshold:")
        logger.info(f"  Base: {base_threshold:.2f}")
        for adj_name, adj_value in adjustments:
            logger.info(f"  {adj_name}: {adj_value:+.2f}")
        logger.info(f"  🎯 FINAL THRESHOLD: {current_threshold:.2f}")
        current_threshold = min(current_threshold, settings.MAX_THRESHOLD)
        logger.info(f"  🔒 CAPPED THRESHOLD: {current_threshold:.2f}")

        return current_threshold, adjustments
    
    def determine_verdict(
        self,
        distance: float,
        threshold: float,
        verified: bool
    ) -> Dict:
        """
        Détermine le verdict final
        
        Args:
            distance: Distance euclidienne
            threshold: Seuil adaptatif
            verified: Si validé ou non
            
        Returns:
            Dict avec verdict et confiance
        """
        if verified:
            if distance < VERDICT_CONFIG["excellent"]["max_distance"]:
                return {
                    "label": VERDICT_CONFIG["excellent"]["label"],
                    "confidence": VERDICT_CONFIG["excellent"]["confidence"],
                    "color": VERDICT_CONFIG["excellent"]["color"]
                }
            elif distance < VERDICT_CONFIG["good"]["max_distance"]:
                return {
                    "label": VERDICT_CONFIG["good"]["label"],
                    "confidence": VERDICT_CONFIG["good"]["confidence"],
                    "color": VERDICT_CONFIG["good"]["color"]
                }
            elif distance < VERDICT_CONFIG["acceptable"]["max_distance"]:
                return {
                    "label": VERDICT_CONFIG["acceptable"]["label"],
                    "confidence": VERDICT_CONFIG["acceptable"]["confidence"],
                    "color": VERDICT_CONFIG["acceptable"]["color"]
                }
            else:
                return {
                    "label": VERDICT_CONFIG["limit"]["label"],
                    "confidence": VERDICT_CONFIG["limit"]["confidence"],
                    "color": VERDICT_CONFIG["limit"]["color"]
                }
        else:
            if distance > 1.50:
                return {
                    "label": VERDICT_CONFIG["no_match"]["label"],
                    "confidence": VERDICT_CONFIG["no_match"]["confidence"],
                    "color": VERDICT_CONFIG["no_match"]["color"]
                }
            else:
                return {
                    "label": VERDICT_CONFIG["no_match_limit"]["label"],
                    "confidence": VERDICT_CONFIG["no_match_limit"]["confidence"],
                    "color": VERDICT_CONFIG["no_match_limit"]["color"]
                }
    
    def compare_faces(
        self,
        license_path: str,
        selfie_path: str
    ) -> Dict:
        """
        Compare un permis de conduire avec un selfie
        
        Args:
            license_path: Chemin vers l'image du permis
            selfie_path: Chemin vers l'image du selfie
            
        Returns:
            Dict avec résultats complets de la comparaison
        """
        logger.info("="*70)
        logger.info("🚀 FACE COMPARISON START")
        logger.info("="*70)
        
        # ====================================================================
        # 1. CHARGER LES IMAGES
        # ====================================================================
        logger.info(f"📂 Loading license: {license_path}")
        img_license = cv2.imread(license_path)
        if img_license is None:
            raise FileNotFoundError(f"Cannot load license image: {license_path}")
        
        logger.info(f"📂 Loading selfie: {selfie_path}")
        img_selfie = cv2.imread(selfie_path)
        if img_selfie is None:
            raise FileNotFoundError(f"Cannot load selfie image: {selfie_path}")
        
        # ====================================================================
        # 2. ROTATION INTELLIGENTE
        # ====================================================================
        (
            img1_rot, angle1, face1_data,
            img2_rot, angle2, face2_data,
            precomputed_similarity
        ) = self.find_best_rotation_by_similarity(img_license, img_selfie)
        
        # ====================================================================
        # 3. CALCUL DE DISTANCE
        # ====================================================================
        distance = 1.0 - precomputed_similarity
        similarity_pct = precomputed_similarity * 100
        
        logger.info(f"\n📊 Metrics:")
        logger.info(f"  Similarity: {similarity_pct:.1f}%")
        logger.info(f"  Distance: {distance:.4f}")
        
        # ====================================================================
        # 4. SEUIL ADAPTATIF
        # ====================================================================
        threshold, adjustments = self.calculate_adaptive_threshold(
            face1_data, face2_data
        )
        
        # ====================================================================
        # 5. VALIDATION
        # ====================================================================
        verified = (distance < threshold)
        margin = threshold - distance
        margin_pct = (margin / threshold) * 100 if threshold > 0 else 0
        
        verdict = self.determine_verdict(distance, threshold, verified)
        
        logger.info(f"\n✅ Validation:")
        logger.info(f"  Distance: {distance:.2f} {'<' if verified else '>'} Threshold: {threshold:.2f}")
        logger.info(f"  Margin: {margin:+.2f} ({margin_pct:+.1f}%)")
        logger.info(f"  🏆 Verdict: {verdict['label']}")
        logger.info(f"  📊 Confidence: {verdict['confidence']}")
        logger.info(f"  {'✅ VERIFIED' if verified else '❌ REJECTED'}")
        
        # ====================================================================
        # 6. RÉSULTAT FINAL
        # ====================================================================
        result = {
            "verified": verified,
            "similarity": float(precomputed_similarity),
            "distance": float(distance),
            "similarity_percentage": float(similarity_pct),
            "threshold": float(threshold),
            "margin": float(margin),
            "verdict": verdict["label"],
            "confidence": verdict["confidence"],
            "color": verdict["color"],
            "license_data": {
                "rotation": angle1,
                "quality_score": float(face1_data["quality_score"]),
                "quality_category": face1_data["quality_category"],
                "occlusion_level": face1_data["occlusion_level"],
                "age": face1_data["age"],
                "gender": face1_data["gender"],
                "sharpness": float(face1_data["sharpness"]),
                "det_score": float(face1_data["det_score"])
            },
            "selfie_data": {
                "rotation": angle2,
                "quality_score": float(face2_data["quality_score"]),
                "quality_category": face2_data["quality_category"],
                "occlusion_level": face2_data["occlusion_level"],
                "age": face2_data["age"],
                "gender": face2_data["gender"],
                "sharpness": float(face2_data["sharpness"]),
                "det_score": float(face2_data["det_score"])
            },
            "adjustments": [
                {"reason": reason, "value": float(value)}
                for reason, value in adjustments
            ]
        }
        
        logger.info("="*70)
        logger.info("✅ COMPARISON COMPLETED")
        logger.info("="*70)
        
        return result



    def compare_faces_from_arrays(
        self,
        img_license: np.ndarray,
        selfie_path: str
    ) -> Dict:
        """
        Compare permis (numpy array en mémoire) avec selfie (chemin fichier)
        Le permis n'est jamais écrit sur disque.
        """
        logger.info("="*70)
        logger.info("🚀 FACE COMPARISON START (license in memory)")
        logger.info("="*70)

        img_selfie = cv2.imread(selfie_path)
        if img_selfie is None:
            raise FileNotFoundError(f"Cannot load selfie: {selfie_path}")

        (
            img1_rot, angle1, face1_data,
            img2_rot, angle2, face2_data,
            precomputed_similarity
        ) = self.find_best_rotation_by_similarity(img_license, img_selfie)

        distance = 1.0 - precomputed_similarity
        similarity_pct = precomputed_similarity * 100

        threshold, adjustments = self.calculate_adaptive_threshold(
            face1_data, face2_data
        )

        verified = (distance < threshold)
        margin = threshold - distance

        verdict = self.determine_verdict(distance, threshold, verified)

        return {
            "verified": verified,
            "similarity": float(precomputed_similarity),
            "distance": float(distance),
            "similarity_percentage": float(similarity_pct),
            "threshold": float(threshold),
            "margin": float(margin),
            "verdict": verdict["label"],
            "confidence": verdict["confidence"],
            "color": verdict["color"],
            "license_data": {
                "rotation": angle1,
                "quality_score": float(face1_data["quality_score"]),
                "quality_category": face1_data["quality_category"],
                "occlusion_level": face1_data["occlusion_level"],
                "age": face1_data["age"],
                "gender": face1_data["gender"],
                "sharpness": float(face1_data["sharpness"]),
                "det_score": float(face1_data["det_score"])
            },
            "selfie_data": {
                "rotation": angle2,
                "quality_score": float(face2_data["quality_score"]),
                "quality_category": face2_data["quality_category"],
                "occlusion_level": face2_data["occlusion_level"],
                "age": face2_data["age"],
                "gender": face2_data["gender"],
                "sharpness": float(face2_data["sharpness"]),
                "det_score": float(face2_data["det_score"])
            },
            "adjustments": [
                {"reason": reason, "value": float(value)}
                for reason, value in adjustments
            ]
        }
        
        

        

