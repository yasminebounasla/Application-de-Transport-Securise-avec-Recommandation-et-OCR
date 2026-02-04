#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
============================================================================
TEST SCRIPT - FACE COMPARISON
============================================================================
Script CLI pour tester la comparaison faciale en local
"""

import sys
import argparse
from pathlib import Path

# Ajouter le dossier parent au path
sys.path.insert(0, str(Path(__file__).parent.parent))

from face_comparison import FaceComparisonEngine
from loguru import logger
import json


def test_comparison(license_path: str, selfie_path: str, output_json: bool = False):
    """
    Test de comparaison faciale
    
    Args:
        license_path: Chemin vers l'image du permis
        selfie_path: Chemin vers l'image du selfie
        output_json: Si True, affiche le résultat en JSON
    """
    logger.info("="*70)
    logger.info("🧪 TEST - FACE COMPARISON")
    logger.info("="*70)
    
    # Initialiser le moteur
    engine = FaceComparisonEngine()
    
    # Comparaison
    try:
        result = engine.compare_faces(license_path, selfie_path)
        
        if output_json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print("\n" + "="*70)
            print("  🏆 RÉSULTAT FINAL")
            print("="*70)
            
            if result["verified"]:
                print(f"\n   ✅ VÉRIFICATION RÉUSSIE")
                print(f"\n   📊 Similarité: {result['similarity_percentage']:.1f}%")
                print(f"   📏 Distance: {result['distance']:.2f}")
                print(f"   🎯 Seuil: {result['threshold']:.2f}")
                print(f"   📈 Marge: {result['margin']:+.2f}")
                print(f"   💪 Confiance: {result['confidence']}")
                print(f"\n   📌 DÉCISION: L'utilisateur PEUT s'inscrire ✅\n")
            else:
                print(f"\n   ❌ VÉRIFICATION ÉCHOUÉE")
                print(f"\n   📊 Similarité: {result['similarity_percentage']:.1f}%")
                print(f"   📏 Distance: {result['distance']:.2f}")
                print(f"   🎯 Seuil: {result['threshold']:.2f}")
                print(f"   📉 Marge: {result['margin']:+.2f}")
                print(f"   ⚠️  Confiance: {result['confidence']}")
                print(f"\n   📌 DÉCISION: L'utilisateur NE PEUT PAS s'inscrire ❌\n")
            
            print("="*70)
            print("\n✅ Test terminé!")
    
    except Exception as e:
        logger.error(f"❌ ERREUR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Test de comparaison faciale permis vs selfie",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples:
  python scripts/test_comparison.py permis.jpg selfie.jpg
  python scripts/test_comparison.py permis.jpg selfie.jpg --json
        """
    )
    
    parser.add_argument(
        "license",
        type=str,
        help="Chemin vers l'image du permis de conduire"
    )
    
    parser.add_argument(
        "selfie",
        type=str,
        help="Chemin vers l'image du selfie"
    )
    
    parser.add_argument(
        "--json",
        action="store_true",
        help="Afficher le résultat en format JSON"
    )
    
    args = parser.parse_args()
    
    # Vérifier que les fichiers existent
    if not Path(args.license).exists():
        print(f"❌ Erreur: Fichier permis non trouvé: {args.license}")
        sys.exit(1)
    
    if not Path(args.selfie).exists():
        print(f"❌ Erreur: Fichier selfie non trouvé: {args.selfie}")
        sys.exit(1)
    
    # Lancer le test
    test_comparison(args.license, args.selfie, args.json)


if __name__ == "__main__":
    main()
