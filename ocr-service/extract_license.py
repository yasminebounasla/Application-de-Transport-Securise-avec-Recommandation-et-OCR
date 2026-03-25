#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🚗 CLI pour extraction de permis de conduire
Usage: python extract_license.py <image_path> [--output result.json]
"""

import argparse
import sys
from pathlib import Path
from ocr_utils import process_driving_license


def main():
    """Point d'entrée CLI"""
    parser = argparse.ArgumentParser(
        description='🚗 Extraction des informations du permis de conduire algérien',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples:
  python extract_license.py permis.jpg
  python extract_license.py permis.jpg --output result.json
  python extract_license.py photos/permis.png --output outputs/result.json
        """
    )
    
    parser.add_argument(
        'image',
        type=str,
        help='Chemin vers l\'image du permis (JPG, PNG, JPEG)'
    )
    
    parser.add_argument(
        '-o', '--output',
        type=str,
        default=None,
        help='Fichier JSON de sortie (optionnel)'
    )
    
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Mode verbeux (affiche tous les détails)'
    )
    
    args = parser.parse_args()
    
    # Vérifier que l'image existe
    image_path = Path(args.image)
    if not image_path.exists():
        print(f"❌ Erreur: Image introuvable: {args.image}")
        sys.exit(1)
    
    # Vérifier l'extension
    valid_extensions = ['.jpg', '.jpeg', '.png', '.bmp']
    if image_path.suffix.lower() not in valid_extensions:
        print(f"❌ Erreur: Format non supporté: {image_path.suffix}")
        print(f"   Formats acceptés: {', '.join(valid_extensions)}")
        sys.exit(1)
    
    # Traiter l'image
    print(f"📸 Traitement de: {image_path.name}\n")
    
    result = process_driving_license(str(image_path), args.output)
    
    if result:
        # Afficher résumé
        print("\n" + "="*80)
        print("📋 RÉSUMÉ DES RÉSULTATS")
        print("="*80)
        print(f"✅ Type: {result.get('type', 'NON DÉTECTÉ')}")
        print(f"🆔 NIN: {result.get('nin', 'Non trouvé')}")
        print(f"📅 Date création: {result.get('date_creation', 'Non trouvée')}")
        print(f"📅 Date expiration: {result.get('date_expiration', 'Non trouvée')}")
        print(f"{'✅' if result.get('is_valid') else '❌'} Validité: {'VALIDE' if result.get('is_valid') else 'INVALIDE'}")
        print("="*80)
        
        sys.exit(0)
    else:
        print("\n❌ Échec de l'extraction")
        sys.exit(1)


if __name__ == "__main__":
    main()
