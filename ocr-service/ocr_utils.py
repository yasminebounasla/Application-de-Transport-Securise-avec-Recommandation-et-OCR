<<<<<<< HEAD
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🚗 EXTRACTION PERMIS DE CONDUIRE - VERSION GITHUB
Module OCR pour extraction des informations du permis de conduire algérien

Auteur: Claude (Adapté pour GitHub)
Date: 2025
"""

import cv2
import numpy as np
import re
from datetime import datetime
import json

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False
    print("⚠️  EasyOCR non disponible. Installez-le avec: pip install easyocr")


# ============================================================================
# DÉTECTION ET CORRECTION DE ROTATION
# ============================================================================

def detect_best_rotation(image_path):
    """
    Détecte automatiquement la meilleure orientation
    Teste 0°, 90°, 180°, 270° et garde la meilleure
    """
    print("="*80)
    print("🔄 DÉTECTION AUTOMATIQUE DE LA ROTATION (4 ANGLES)")
    print("="*80)
    print()

    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"❌ Impossible de charger l'image: {image_path}")

    print("🔍 Test de 4 orientations (0°, 90°, 180°, 270°)...")

    if not EASYOCR_AVAILABLE:
        print("⚠️  EasyOCR non disponible, rotation par défaut: 0°")
        return img, 0

    try:
        reader = easyocr.Reader(['en', 'fr'], gpu=False, verbose=False)
    except Exception as e:
        print(f"⚠️  Erreur lors de l'initialisation d'EasyOCR: {e}")
        return img, 0

    angles = [0, 90, 180, 270]
    best_score = -1
    best_angle = 0
    best_image = img.copy()

    for angle in angles:
        # Rotation
        if angle == 0:
            rotated = img.copy()
        elif angle == 90:
            rotated = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
        elif angle == 180:
            rotated = cv2.rotate(img, cv2.ROTATE_180)
        elif angle == 270:
            rotated = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)

        # Test OCR rapide
        try:
            # Réduire la taille pour test rapide
            small = cv2.resize(rotated, (800, int(800 * rotated.shape[0] / rotated.shape[1])))
            results = reader.readtext(small, detail=1)

            # Score = nombre de mots détectés + confiance moyenne
            if results:
                avg_confidence = sum([r[2] for r in results]) / len(results)
                score = len(results) * avg_confidence
            else:
                score = 0

            print(f"   {angle:3d}° → {len(results):2d} mots détectés, score: {score:.2f}")

            if score > best_score:
                best_score = score
                best_angle = angle
                best_image = rotated.copy()

        except Exception as e:
            print(f"   {angle:3d}° → Erreur: {str(e)}")
            continue

    print()
    if best_angle != 0:
        print(f"✅ Meilleure orientation: {best_angle}° (score: {best_score:.2f})")
        print(f"🔄 Image automatiquement tournée de {best_angle}°\n")
    else:
        print(f"✅ Orientation correcte détectée: 0° (pas de rotation)\n")

    return best_image, best_angle


# ============================================================================
# PRÉTRAITEMENT AVANCÉ
# ============================================================================

def advanced_preprocess(image, show_steps=False):
    """
    Prétraitement OPTIMAL pour tous types de fonds
    (blanc, bois, marron, noir, etc.)
    """
    print("="*80)
    print("🎨 PRÉTRAITEMENT AVANCÉ (TOUS FONDS)")
    print("="*80)

    img = image
    height, width = img.shape[:2]
    print(f"\n📐 Dimensions: {width}x{height} pixels")

    # ===== UPSCALING AGRESSIF =====
    target_width = max(3000, width * 3)
    scale = target_width / width
    new_height = int(height * scale)

    print(f"🔍 Upscaling {scale:.1f}x → {target_width}x{new_height} pixels")
    high_res = cv2.resize(img, (target_width, new_height), interpolation=cv2.INTER_LANCZOS4)

    # ===== GRAYSCALE =====
    gray = cv2.cvtColor(high_res, cv2.COLOR_BGR2GRAY)

    # ===== AMÉLIORATION DU CONTRASTE (CLAHE) =====
    print("🎨 Amélioration du contraste (adaptatif tous fonds)...")
    clahe = cv2.createCLAHE(clipLimit=3.5, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # ===== DÉBRUITAGE =====
    print("🧹 Suppression du bruit (textures/bois/etc.)...")
    denoised = cv2.fastNlMeansDenoising(enhanced, None, h=10, templateWindowSize=7, searchWindowSize=21)

    # ===== SHARPENING =====
    print("✨ Amélioration de la netteté...")
    kernel_sharpen = np.array([
        [ 0, -1,  0],
        [-1,  6, -1],
        [ 0, -1,  0]
    ])
    sharpened = cv2.filter2D(denoised, -1, kernel_sharpen)

    # ===== BINARISATION ADAPTATIVE =====
    print("⚫⚪ Binarisation adaptative (blanc/noir/bois)...")
    binary = cv2.adaptiveThreshold(
        sharpened, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=15,
        C=8
    )

    # ===== MORPHOLOGIE =====
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    final = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)

    print("✅ Prétraitement terminé!\n")

    return final, high_res


# ============================================================================
# OCR AVEC COORDONNÉES SPATIALES
# ============================================================================

def run_easyocr_with_coords(image, color_image):
    """
    EasyOCR avec extraction des coordonnées spatiales
    """
    print("="*80)
    print("🔍 EXTRACTION OCR (EASYOCR)")
    print("="*80)
    print()

    if not EASYOCR_AVAILABLE:
        raise ImportError("EasyOCR est requis. Installez-le avec: pip install easyocr")

    try:
        print("🔹 EasyOCR avec coordonnées spatiales...")
        reader = easyocr.Reader(['en', 'fr'], gpu=False, verbose=False)

        # Essayer sur binaire ET couleur
        results_binary = reader.readtext(image, detail=1, paragraph=False)
        results_color = reader.readtext(color_image, detail=1, paragraph=False)

        # Combiner les résultats
        all_results = results_binary + results_color

        # Extraire le texte unique avec coordonnées
        seen = set()
        unique_results = []
        for res in all_results:
            bbox, text, conf = res
            text_clean = text.strip()

            if text_clean and text_clean not in seen:
                # Calculer position Y moyenne (ligne)
                y_avg = sum([point[1] for point in bbox]) / 4
                x_avg = sum([point[0] for point in bbox]) / 4

                unique_results.append({
                    'text': text_clean,
                    'x': x_avg,
                    'y': y_avg,
                    'confidence': conf,
                    'bbox': bbox
                })
                seen.add(text_clean)

        # Trier par position Y (de haut en bas)
        unique_results.sort(key=lambda r: r['y'])

        full_text = ' '.join([r['text'] for r in unique_results])

        print(f"   ✅ {len(unique_results)} éléments détectés")
        print(f"   ✅ {len(full_text)} caractères extraits")
        print("   ✅ OCR terminé!\n")

        return full_text, unique_results

    except Exception as e:
        print(f"   ❌ Erreur EasyOCR: {str(e)}")
        return "", []


# ============================================================================
# EXTRACTION DES INFORMATIONS
# ============================================================================

def fuzzy_match_license(text, ocr_results):
    """
    Détection "DRIVING LICENSE" ULTRA-tolérante
    """
    print("🔍 Détection 'DRIVING LICENSE' (ULTRA-tolérant)...")

    text_upper = text.upper()

    # Méthode 1: Pattern exact
    pattern_exact = r'DRIVING\s+LICENSE'
    match_exact = re.search(pattern_exact, text_upper)

    if match_exact:
        print(f"   ✅ 'DRIVING LICENSE' trouvé (exact)")
        return True, "DRIVING LICENSE"

    # Méthode 2: Patterns ULTRA-tolérants
    patterns_fuzzy = [
        r'DRIVING\s+LICEN[CS]E',
        r'DRIVING\s+[UL]ICEN[CS]E',
        r'DRIVING\s+LI[CS]EN[CS]E',
        r'DR[I1]V[I1]NG\s+LICENSE',
        r'DRIVING\s+\(ICENSE',
        r'DRIVING\s+\[ICENSE',
        r'DRIVING\s+UCENSE',
        r'DRIVING\s+L[I1]CEN[S5]E',
        r'DR[I1]V[I1I]?NG\s+L[I1]CEN[CS5]E',
        r'DRIVING[\s\-_]+LICENSE',
        r'DRIVING[\s\-_]+LICEN[CS]E',
    ]

    for pattern in patterns_fuzzy:
        match = re.search(pattern, text_upper)
        if match:
            print(f"   ✅ 'DRIVING LICENSE' trouvé (variation): '{match.group()}'")
            return True, "DRIVING LICENSE"

    # Méthode 3: Vérifier mots séparés + position spatiale
    has_driving = any(word in text_upper for word in ['DRIVING', 'DRIV'])
    has_license = any(word in text_upper for word in ['LICENSE', 'LICENCE', 'LICEN', 'UCENSE', 'ICENSE', '(ICENSE'])

    if has_driving and has_license and ocr_results:
        max_y = max([r['y'] for r in ocr_results]) if ocr_results else float('inf')
        height_threshold = max_y * 0.3

        driving_words = [r for r in ocr_results if any(w in r['text'].upper() for w in ['DRIV'])]
        license_words = [r for r in ocr_results if any(w in r['text'].upper() for w in ['LICEN', 'UCENSE', 'ICENSE', '(ICENSE'])]

        driving_top = any(r['y'] < height_threshold for r in driving_words)
        license_top = any(r['y'] < height_threshold for r in license_words)

        if driving_top and license_top:
            print(f"   ✅ 'DRIVING' + 'LICENSE' trouvés dans le TOP de l'image")
            return True, "DRIVING LICENSE"

    print(f"   ⚠️  'DRIVING LICENSE' non détecté")
    return False, None


def extract_dates_spatial(text, ocr_results):
    """
    Extraction dates par POSITION SPATIALE uniquement
    """
    print("🔍 Extraction des dates (POSITION SPATIALE: TOP-CENTRE-DROITE)...")

    if not ocr_results:
        print("   ❌ Pas de résultats OCR")
        return None, None

    max_y = max([r['y'] for r in ocr_results])
    max_x = max([r['x'] for r in ocr_results])

    top_threshold = max_y * 0.4
    right_threshold = max_x * 0.5

    print(f"   📏 Zone de recherche: Y < {top_threshold:.0f} (TOP 40%), X > {right_threshold:.0f} (DROITE 50%)")

    date_pattern = r'(\d{2})[/\.](\d{2})[/\.](\d{4})'

    dates_with_coords = []

    for res in ocr_results:
        text_item = res['text']
        matches = re.findall(date_pattern, text_item)

        if matches:
            for match in matches:
                date_str = f"{match[0]}.{match[1]}.{match[2]}"
                y_pos = res['y']
                x_pos = res['x']

                is_top = y_pos < top_threshold
                is_right = x_pos > right_threshold

                dates_with_coords.append({
                    'date': date_str,
                    'y': y_pos,
                    'x': x_pos,
                    'is_top': is_top,
                    'is_right': is_right,
                    'text': text_item
                })

                zone = "TOP-DROITE" if (is_top and is_right) else \
                       "TOP" if is_top else \
                       "DROITE" if is_right else \
                       "CENTRE"

                print(f"      • {date_str} (Y={y_pos:.0f}, X={x_pos:.0f}) → Zone: {zone}")

    if not dates_with_coords:
        print("   ❌ Aucune date trouvée")
        return None, None

    top_dates = [d for d in dates_with_coords if d['is_top']]

    if not top_dates:
        print("   ⚠️  Aucune date dans le TOP, prise de toutes les dates")
        top_dates = dates_with_coords

    top_dates.sort(key=lambda d: d['y'])

    if len(top_dates) >= 2:
        date_creation = top_dates[0]['date']
        date_expiration = top_dates[1]['date']

        print(f"\n   ✅ Date création: {date_creation} (Y={top_dates[0]['y']:.0f})")
        print(f"   ✅ Date expiration: {date_expiration} (Y={top_dates[1]['y']:.0f})")

        return date_creation, date_expiration

    elif len(top_dates) == 1:
        print(f"\n   ⚠️  Une seule date trouvée: {top_dates[0]['date']}")
        return top_dates[0]['date'], None

    else:
        print("   ❌ Pas assez de dates trouvées")
        return None, None


def extract_driving_license_info(text, ocr_results):
    """
    Extraction avec validation stricte
    """
    print("="*80)
    print("📊 EXTRACTION DES INFORMATIONS")
    print("="*80)
    print()

    info = {
        'type': None,
        'is_driving_license': False,
        'nom': None,
        'prenom': None,
        'nin': None,
        'date_creation': None,
        'date_expiration': None,
        'is_valid': False,
        'validation_details': {
            'type_detected': False,
            'expiration_future': False
        },
        'raw_text': text
    }

    text_upper = text.upper()

    # ===== 1. TYPE =====
    print("🔍 1. Vérification du type...")
    is_license, license_type = fuzzy_match_license(text, ocr_results)

    if is_license:
        info['type'] = license_type
        info['is_driving_license'] = True
        info['validation_details']['type_detected'] = True
        print()
    else:
        print()

    # ===== 2. NIN =====
    print("🔍 2. Extraction du NIN (18 chiffres)...")

    nin_patterns = [
        r'\b(\d{18})\b',
        r'(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{2})',
    ]

    nin_found = False
    for pattern in nin_patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            nin_clean = re.sub(r'[\s\-]', '', match)
            if len(nin_clean) == 18 and nin_clean.isdigit():
                info['nin'] = nin_clean
                print(f"   ✅ NIN trouvé: {nin_clean}")
                nin_found = True
                break
        if nin_found:
            break

    if not nin_found:
        long_numbers = re.findall(r'\b(\d{15,20})\b', text)
        if long_numbers:
            candidate = max(long_numbers, key=len)
            if len(candidate) >= 16:
                info['nin'] = candidate
                print(f"   ⚠️  NIN possible: {candidate} ({len(candidate)} chiffres)")

        if not info['nin']:
            print("   ❌ NIN non trouvé")

    # ===== 3. NOM/PRÉNOM =====
    print("\n🔍 3. Extraction nom/prénom...")

    if ocr_results and info['nin']:
        nin_index = -1
        for i, res in enumerate(ocr_results):
            if info['nin'] in res['text']:
                nin_index = i
                print(f"      • NIN trouvé à l'index {i}")
                break

        if nin_index > 0:
            candidates = []
            for i in range(max(0, nin_index - 10), nin_index):
                res = ocr_results[i]
                text_item = res['text']

                if (len(text_item) >= 3 and
                    text_item.isupper() and
                    not any(c.isdigit() for c in text_item)):

                    excluded = ['DRIVING', 'LICENSE', 'LICENCE', 'DZ', 'REPUBLIC',
                                'ALGERIA', 'THE', 'SRE', 'APÛ', 'DJQ', 'UCENSE',
                                'DRIV', 'LIC', 'UCE', 'NSE', 'ICENSE', '(ICENSE']

                    is_excluded = any(ex in text_item for ex in excluded)

                    if not is_excluded:
                        candidates.append({'text': text_item, 'index': i})
                        print(f"      • Candidat: '{text_item}'")

            if len(candidates) >= 1:
                info['nom'] = candidates[0]['text']
                print(f"   ✅ Nom: {info['nom']}")

            if len(candidates) >= 2:
                info['prenom'] = candidates[1]['text']
                print(f"   ✅ Prénom: {info['prenom']}")

    if not info['nom'] and not info['prenom']:
        print("   ❌ Nom et prénom non trouvés")

    # ===== 4. DATES =====
    print("\n🔍 4. Extraction des dates...")
    date_creation, date_expiration = extract_dates_spatial(text, ocr_results)

    info['date_creation'] = date_creation
    info['date_expiration'] = date_expiration

    # ===== 5. VALIDATION =====
    print("\n🔍 5. Validation du permis...")

    if date_expiration:
        try:
            parts = date_expiration.split('.')
            exp_date = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
            today = datetime.now()

            is_future = exp_date > today
            info['validation_details']['expiration_future'] = is_future

            if info['is_driving_license'] and is_future:
                info['is_valid'] = True
                print(f"   ✅ PERMIS VALIDE")
            else:
                info['is_valid'] = False
                print(f"   ❌ PERMIS INVALIDE")
        except:
            info['is_valid'] = False
            print(f"   ⚠️  Impossible de valider")
    else:
        info['is_valid'] = False
        print(f"   ⚠️  Impossible de valider (pas de date)")

    print()
    return info


# ============================================================================
# FONCTION PRINCIPALE
# ============================================================================

def process_driving_license(image_path, output_json=None):
    """
    Fonction principale pour traiter un permis de conduire
    
    Args:
        image_path: Chemin vers l'image du permis
        output_json: Chemin optionnel pour sauvegarder le JSON
        
    Returns:
        dict: Informations extraites
    """
    print("\n")
    print("="*80)
    print("🚗 EXTRACTION PERMIS DE CONDUIRE - VERSION GITHUB")
    print("="*80)
    print()

    try:
        # Détection rotation
        rotated_image, rotation_angle = detect_best_rotation(image_path)

        # Prétraitement
        binary_img, color_img = advanced_preprocess(rotated_image, show_steps=False)

        # OCR
        full_text, ocr_results = run_easyocr_with_coords(binary_img, color_img)

        # Extraction
        info = extract_driving_license_info(full_text, ocr_results)

        # Sauvegarde JSON
        if output_json:
            with open(output_json, 'w', encoding='utf-8') as f:
                info_copy = info.copy()
                info_copy.pop('raw_text', None)
                json.dump(info_copy, f, indent=2, ensure_ascii=False)
            print(f"💾 Résultats sauvegardés: {output_json}")

        print("\n✅ EXTRACTION TERMINÉE!\n")
        return info

    except Exception as e:
        print(f"\n❌ ERREUR: {str(e)}")
        import traceback
        traceback.print_exc()
        return None
=======
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🚗 EXTRACTION PERMIS DE CONDUIRE - VERSION GITHUB
Module OCR pour extraction des informations du permis de conduire algérien

Auteur: Claude (Adapté pour GitHub)
Date: 2025
"""

import cv2
import numpy as np
import re
from datetime import datetime
import json

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False
    print("⚠️  EasyOCR non disponible. Installez-le avec: pip install easyocr")


# ============================================================================
# DÉTECTION ET CORRECTION DE ROTATION
# ============================================================================

def detect_best_rotation(image_path):
    """
    Détecte automatiquement la meilleure orientation
    Teste 0°, 90°, 180°, 270° et garde la meilleure
    """
    print("="*80)
    print("🔄 DÉTECTION AUTOMATIQUE DE LA ROTATION (4 ANGLES)")
    print("="*80)
    print()

    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"❌ Impossible de charger l'image: {image_path}")

    print("🔍 Test de 4 orientations (0°, 90°, 180°, 270°)...")

    if not EASYOCR_AVAILABLE:
        print("⚠️  EasyOCR non disponible, rotation par défaut: 0°")
        return img, 0

    try:
        reader = easyocr.Reader(['en', 'fr'], gpu=False, verbose=False)
    except Exception as e:
        print(f"⚠️  Erreur lors de l'initialisation d'EasyOCR: {e}")
        return img, 0

    angles = [0, 90, 180, 270]
    best_score = -1
    best_angle = 0
    best_image = img.copy()

    for angle in angles:
        # Rotation
        if angle == 0:
            rotated = img.copy()
        elif angle == 90:
            rotated = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
        elif angle == 180:
            rotated = cv2.rotate(img, cv2.ROTATE_180)
        elif angle == 270:
            rotated = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)

        # Test OCR rapide
        try:
            # Réduire la taille pour test rapide
            small = cv2.resize(rotated, (800, int(800 * rotated.shape[0] / rotated.shape[1])))
            results = reader.readtext(small, detail=1)

            # Score = nombre de mots détectés + confiance moyenne
            if results:
                avg_confidence = sum([r[2] for r in results]) / len(results)
                score = len(results) * avg_confidence
            else:
                score = 0

            print(f"   {angle:3d}° → {len(results):2d} mots détectés, score: {score:.2f}")

            if score > best_score:
                best_score = score
                best_angle = angle
                best_image = rotated.copy()

        except Exception as e:
            print(f"   {angle:3d}° → Erreur: {str(e)}")
            continue

    print()
    if best_angle != 0:
        print(f"✅ Meilleure orientation: {best_angle}° (score: {best_score:.2f})")
        print(f"🔄 Image automatiquement tournée de {best_angle}°\n")
    else:
        print(f"✅ Orientation correcte détectée: 0° (pas de rotation)\n")

    return best_image, best_angle


# ============================================================================
# PRÉTRAITEMENT AVANCÉ
# ============================================================================

def advanced_preprocess(image, show_steps=False):
    """
    Prétraitement OPTIMAL pour tous types de fonds
    (blanc, bois, marron, noir, etc.)
    """
    print("="*80)
    print("🎨 PRÉTRAITEMENT AVANCÉ (TOUS FONDS)")
    print("="*80)

    img = image
    height, width = img.shape[:2]
    print(f"\n📐 Dimensions: {width}x{height} pixels")

    # ===== UPSCALING AGRESSIF =====
    target_width = max(3000, width * 3)
    scale = target_width / width
    new_height = int(height * scale)

    print(f"🔍 Upscaling {scale:.1f}x → {target_width}x{new_height} pixels")
    high_res = cv2.resize(img, (target_width, new_height), interpolation=cv2.INTER_LANCZOS4)

    # ===== GRAYSCALE =====
    gray = cv2.cvtColor(high_res, cv2.COLOR_BGR2GRAY)

    # ===== AMÉLIORATION DU CONTRASTE (CLAHE) =====
    print("🎨 Amélioration du contraste (adaptatif tous fonds)...")
    clahe = cv2.createCLAHE(clipLimit=3.5, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # ===== DÉBRUITAGE =====
    print("🧹 Suppression du bruit (textures/bois/etc.)...")
    denoised = cv2.fastNlMeansDenoising(enhanced, None, h=10, templateWindowSize=7, searchWindowSize=21)

    # ===== SHARPENING =====
    print("✨ Amélioration de la netteté...")
    kernel_sharpen = np.array([
        [ 0, -1,  0],
        [-1,  6, -1],
        [ 0, -1,  0]
    ])
    sharpened = cv2.filter2D(denoised, -1, kernel_sharpen)

    # ===== BINARISATION ADAPTATIVE =====
    print("⚫⚪ Binarisation adaptative (blanc/noir/bois)...")
    binary = cv2.adaptiveThreshold(
        sharpened, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=15,
        C=8
    )

    # ===== MORPHOLOGIE =====
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    final = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)

    print("✅ Prétraitement terminé!\n")

    return final, high_res


# ============================================================================
# OCR AVEC COORDONNÉES SPATIALES
# ============================================================================

def run_easyocr_with_coords(image, color_image):
    """
    EasyOCR avec extraction des coordonnées spatiales
    """
    print("="*80)
    print("🔍 EXTRACTION OCR (EASYOCR)")
    print("="*80)
    print()

    if not EASYOCR_AVAILABLE:
        raise ImportError("EasyOCR est requis. Installez-le avec: pip install easyocr")

    try:
        print("🔹 EasyOCR avec coordonnées spatiales...")
        reader = easyocr.Reader(['en', 'fr'], gpu=False, verbose=False)

        # Essayer sur binaire ET couleur
        results_binary = reader.readtext(image, detail=1, paragraph=False)
        results_color = reader.readtext(color_image, detail=1, paragraph=False)

        # Combiner les résultats
        all_results = results_binary + results_color

        # Extraire le texte unique avec coordonnées
        seen = set()
        unique_results = []
        for res in all_results:
            bbox, text, conf = res
            text_clean = text.strip()

            if text_clean and text_clean not in seen and conf >= 0.5:
                # Calculer position Y moyenne (ligne)
                y_avg = sum([point[1] for point in bbox]) / 4
                x_avg = sum([point[0] for point in bbox]) / 4

                unique_results.append({
                    'text': text_clean,
                    'x': x_avg,
                    'y': y_avg,
                    'confidence': conf,
                    'bbox': bbox
                })
                seen.add(text_clean)

        # Trier par position Y (de haut en bas)
        unique_results.sort(key=lambda r: r['y'])

        full_text = ' '.join([r['text'] for r in unique_results])

        print(f"   ✅ {len(unique_results)} éléments détectés")
        print(f"   ✅ {len(full_text)} caractères extraits")
        print("   ✅ OCR terminé!\n")

        return full_text, unique_results

    except Exception as e:
        print(f"   ❌ Erreur EasyOCR: {str(e)}")
        return "", []


# ============================================================================
# EXTRACTION DES INFORMATIONS
# ============================================================================

def fuzzy_match_license(text, ocr_results):
    """
    Détection "DRIVING LICENSE" ULTRA-tolérante
    """
    print("🔍 Détection 'DRIVING LICENSE' (ULTRA-tolérant)...")

    text_upper = text.upper()

    # Méthode 1: Pattern exact
    pattern_exact = r'DRIVING\s+LICENSE'
    match_exact = re.search(pattern_exact, text_upper)

    if match_exact:
        print(f"   ✅ 'DRIVING LICENSE' trouvé (exact)")
        return True, "DRIVING LICENSE"

    # Méthode 2: Patterns ULTRA-tolérants
    patterns_fuzzy = [
        r'DRIVING\s+LICEN[CS]E',
        r'DRIVING\s+[UL]ICEN[CS]E',
        r'DRIVING\s+LI[CS]EN[CS]E',
        r'DR[I1]V[I1]NG\s+LICENSE',
        r'DRIVING\s+\(ICENSE',
        r'DRIVING\s+\[ICENSE',
        r'DRIVING\s+UCENSE',
        r'DRIVING\s+L[I1]CEN[S5]E',
        r'DR[I1]V[I1I]?NG\s+L[I1]CEN[CS5]E',
        r'DRIVING[\s\-_]+LICENSE',
        r'DRIVING[\s\-_]+LICEN[CS]E',
    ]

    for pattern in patterns_fuzzy:
        match = re.search(pattern, text_upper)
        if match:
            print(f"   ✅ 'DRIVING LICENSE' trouvé (variation): '{match.group()}'")
            return True, "DRIVING LICENSE"

    # Méthode 3: Vérifier mots séparés + position spatiale
    has_driving = any(word in text_upper for word in ['DRIVING', 'DRIV'])
    has_license = any(word in text_upper for word in ['LICENSE', 'LICENCE', 'LICEN', 'UCENSE', 'ICENSE', '(ICENSE'])

    if has_driving and has_license and ocr_results:
        max_y = max([r['y'] for r in ocr_results]) if ocr_results else float('inf')
        height_threshold = max_y * 0.3

        driving_words = [r for r in ocr_results if any(w in r['text'].upper() for w in ['DRIV'])]
        license_words = [r for r in ocr_results if any(w in r['text'].upper() for w in ['LICEN', 'UCENSE', 'ICENSE', '(ICENSE'])]

        driving_top = any(r['y'] < height_threshold for r in driving_words)
        license_top = any(r['y'] < height_threshold for r in license_words)

        if driving_top and license_top:
            print(f"   ✅ 'DRIVING' + 'LICENSE' trouvés dans le TOP de l'image")
            return True, "DRIVING LICENSE"

    print(f"   ⚠️  'DRIVING LICENSE' non détecté")
    return False, None


def extract_dates_spatial(text, ocr_results):
    """
    Extraction dates par POSITION SPATIALE uniquement
    """
    print("🔍 Extraction des dates (POSITION SPATIALE: TOP-CENTRE-DROITE)...")

    if not ocr_results:
        print("   ❌ Pas de résultats OCR")
        return None, None

    max_y = max([r['y'] for r in ocr_results])
    max_x = max([r['x'] for r in ocr_results])

    top_threshold = max_y * 0.4
    right_threshold = max_x * 0.5

    print(f"   📏 Zone de recherche: Y < {top_threshold:.0f} (TOP 40%), X > {right_threshold:.0f} (DROITE 50%)")

    date_pattern = r'(\d{2})[/\.](\d{2})[/\.](\d{4})'

    dates_with_coords = []

    for res in ocr_results:
        text_item = res['text']
        matches = re.findall(date_pattern, text_item)

        if matches:
            for match in matches:
                date_str = f"{match[0]}.{match[1]}.{match[2]}"
                y_pos = res['y']
                x_pos = res['x']

                is_top = y_pos < top_threshold
                is_right = x_pos > right_threshold

                dates_with_coords.append({
                    'date': date_str,
                    'y': y_pos,
                    'x': x_pos,
                    'is_top': is_top,
                    'is_right': is_right,
                    'text': text_item
                })

                zone = "TOP-DROITE" if (is_top and is_right) else \
                       "TOP" if is_top else \
                       "DROITE" if is_right else \
                       "CENTRE"

                print(f"      • {date_str} (Y={y_pos:.0f}, X={x_pos:.0f}) → Zone: {zone}")

    if not dates_with_coords:
        print("   ❌ Aucune date trouvée")
        return None, None

    top_dates = [d for d in dates_with_coords if d['is_top']]

    if not top_dates:
        print("   ⚠️  Aucune date dans le TOP, prise de toutes les dates")
        top_dates = dates_with_coords

    top_dates.sort(key=lambda d: d['y'])

    if len(top_dates) >= 2:
        date_creation = top_dates[0]['date']
        date_expiration = top_dates[1]['date']

        print(f"\n   ✅ Date création: {date_creation} (Y={top_dates[0]['y']:.0f})")
        print(f"   ✅ Date expiration: {date_expiration} (Y={top_dates[1]['y']:.0f})")

        return date_creation, date_expiration

    elif len(top_dates) == 1:
        print(f"\n   ⚠️  Une seule date trouvée: {top_dates[0]['date']}")
        return top_dates[0]['date'], None

    else:
        print("   ❌ Pas assez de dates trouvées")
        return None, None


def extract_driving_license_info(text, ocr_results):
    """
    Extraction avec validation stricte
    """
    print("="*80)
    print("📊 EXTRACTION DES INFORMATIONS")
    print("="*80)
    print()

    info = {
        'type': None,
        'is_driving_license': False,
        'nin': None,
        'date_creation': None,
        'date_expiration': None,
        'is_valid': False,
        'validation_details': {
            'type_detected': False,
            'expiration_future': False
        },
        'raw_text': text
    }

    text_upper = text.upper()

    # ===== 1. TYPE =====
    print("🔍 1. Vérification du type...")
    is_license, license_type = fuzzy_match_license(text, ocr_results)

    if is_license:
        info['type'] = license_type
        info['is_driving_license'] = True
        info['validation_details']['type_detected'] = True
        print()
    else:
        print()

    # ===== 2. NIN =====
    print("🔍 2. Extraction du NIN (18 chiffres)...")

    nin_patterns = [
        r'\b(\d{18})\b',
        r'(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{2})',
    ]

    nin_found = False
    for pattern in nin_patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            nin_clean = re.sub(r'[\s\-]', '', match)
            if len(nin_clean) == 18 and nin_clean.isdigit():
                info['nin'] = nin_clean
                print(f"   ✅ NIN trouvé: {nin_clean}")
                nin_found = True
                break
        if nin_found:
            break

    if not nin_found:
        long_numbers = re.findall(r'\b(\d{15,20})\b', text)
        if long_numbers:
            candidate = max(long_numbers, key=len)
            if len(candidate) >= 16:
                info['nin'] = candidate
                print(f"   ⚠️  NIN possible: {candidate} ({len(candidate)} chiffres)")

        if not info['nin']:
            print("   ❌ NIN non trouvé")

    
    # ===== 3. DATES =====
    print("\n🔍 3. Extraction des dates...")
    date_creation, date_expiration = extract_dates_spatial(text, ocr_results)

    info['date_creation'] = date_creation
    info['date_expiration'] = date_expiration

    # ===== 4. VALIDATION =====
    print("\n🔍 4. Validation du permis...")

    if date_expiration:
        try:
            parts = date_expiration.split('.')
            exp_date = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
            today = datetime.now()

            is_future = exp_date > today
            info['validation_details']['expiration_future'] = is_future

            if info['is_driving_license'] and is_future:
                info['is_valid'] = True
                print(f"   ✅ PERMIS VALIDE")
            else:
                info['is_valid'] = False
                print(f"   ❌ PERMIS INVALIDE")
        except:
            info['is_valid'] = False
            print(f"   ⚠️  Impossible de valider")
    else:
        info['is_valid'] = False
        print(f"   ⚠️  Impossible de valider (pas de date)")

    print()
    return info


# ============================================================================
# FONCTION PRINCIPALE
# ============================================================================

def process_driving_license(image_path, output_json=None):
    """
    Fonction principale pour traiter un permis de conduire
    
    Args:
        image_path: Chemin vers l'image du permis
        output_json: Chemin optionnel pour sauvegarder le JSON
        
    Returns:
        dict: Informations extraites
    """
    print("\n")
    print("="*80)
    print("🚗 EXTRACTION PERMIS DE CONDUIRE - VERSION GITHUB")
    print("="*80)
    print()

    try:
        # Détection rotation
        rotated_image, rotation_angle = detect_best_rotation(image_path)

        # Prétraitement
        binary_img, color_img = advanced_preprocess(rotated_image, show_steps=False)

        # OCR
        full_text, ocr_results = run_easyocr_with_coords(binary_img, color_img)

        # Extraction
        info = extract_driving_license_info(full_text, ocr_results)

        # Sauvegarde JSON
        if output_json:
            with open(output_json, 'w', encoding='utf-8') as f:
                info_copy = info.copy()
                info_copy.pop('raw_text', None)
                json.dump(info_copy, f, indent=2, ensure_ascii=False)
            print(f"💾 Résultats sauvegardés: {output_json}")

        print("\n✅ EXTRACTION TERMINÉE!\n")
        return info

    except Exception as e:
        print(f"\n❌ ERREUR: {str(e)}")
        import traceback
        traceback.print_exc()
        return None
>>>>>>> 46ff32f16fb87b43f9091e209998127c51f2ff47
