# 🚗 Driving License OCR - Extraction Permis de Conduire Algérien

Système d'extraction automatique des informations du permis de conduire algérien utilisant OCR (Optical Character Recognition).

## ✨ Fonctionnalités

- ✅ **Détection automatique de rotation** (0°/90°/180°/270°)
- ✅ **Support de tous les fonds** (blanc, bois, noir, etc.)
- ✅ **Extraction spatiale des dates** (position TOP-CENTRE-DROITE)
- ✅ **Validation stricte** (TYPE détecté + date d'expiration future)
- ✅ **Pattern LICENSE ultra-tolérant** ("(icense", "Ucense", etc.)
- ✅ **API REST FastAPI**
- ✅ **CLI pour utilisation en ligne de commande**

## 📦 Installation

### Prérequis

- Python 3.8+
- pip

### Installation des dépendances

```bash
pip install -r requirements.txt
```

### Installation manuelle

```bash
pip install opencv-python numpy easyocr fastapi uvicorn python-multipart pillow
```

## 🚀 Utilisation

### 1. Ligne de commande (CLI)

```bash
# Extraction simple
python extract_license.py permis.jpg

# Avec sauvegarde JSON
python extract_license.py permis.jpg --output result.json

# Avec chemin complet
python extract_license.py /path/to/permis.png --output /path/to/result.json
```

### 2. API REST (FastAPI)

#### Démarrer le serveur

```bash
python app.py
```

Le serveur démarre sur `http://localhost:8000`

#### Endpoints disponibles

**GET /** - Page d'accueil
```bash
curl http://localhost:8000/
```

**GET /health** - Vérification de santé
```bash
curl http://localhost:8000/health
```

**POST /extract** - Extraction d'un permis
```bash
curl -X POST http://localhost:8000/extract \
  -F "file=@permis.jpg"
```

**POST /extract/batch** - Extraction batch (max 10 images)
```bash
curl -X POST http://localhost:8000/extract/batch \
  -F "files=@permis1.jpg" \
  -F "files=@permis2.jpg"
```

#### Documentation interactive

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 3. Utilisation dans du code Python

```python
from ocr_utils import process_driving_license

# Traiter une image
result = process_driving_license("permis.jpg")

# Avec sauvegarde JSON
result = process_driving_license("permis.jpg", output_json="result.json")

# Accéder aux informations
if result:
    print(f"Type: {result['type']}")
    print(f"Nom: {result['nom']}")
    print(f"Prénom: {result['prenom']}")
    print(f"NIN: {result['nin']}")
    print(f"Valide: {result['is_valid']}")
```

## 📊 Format de sortie

```json
{
  "type": "DRIVING LICENSE",
  "is_driving_license": true,
  "nom": "DUPONT",
  "prenom": "JEAN",
  "nin": "123456789012345678",
  "date_creation": "15.01.2020",
  "date_expiration": "15.01.2030",
  "is_valid": true,
  "validation_details": {
    "type_detected": true,
    "expiration_future": true
  }
}
```

## 🏗️ Structure du projet

```
ocr-services/
├── app.py                 # API FastAPI
├── extract_license.py     # Script CLI
├── ocr_utils.py          # Fonctions d'extraction OCR
├── requirements.txt      # Dépendances Python
├── README.md            # Documentation
├── model/               # (Optionnel) Modèles ML
├── outputs/             # Résultats d'extraction
└── train/               # (Optionnel) Données d'entraînement
```

## 🔧 Configuration

### Variables d'environnement (optionnel)

```bash
# Port de l'API (défaut: 8000)
export API_PORT=8000

# Niveau de log
export LOG_LEVEL=INFO
```

## 🧪 Tests

```bash
# Test avec image d'exemple
python extract_license.py test_images/permis_exemple.jpg

# Test API
curl -X POST http://localhost:8000/extract \
  -F "file=@test_images/permis_exemple.jpg"
```

## 📝 Notes importantes

### Validation stricte

Le permis est considéré comme **VALIDE** uniquement si :
1. ✅ Type "DRIVING LICENSE" détecté
2. ✅ Date d'expiration dans le futur

### Formats supportés

- JPG / JPEG
- PNG
- BMP

### Performance

- **Temps moyen d'extraction** : 5-15 secondes par image
- **Précision OCR** : ~90-95% selon la qualité de l'image
- **GPU** : Optionnel (EasyOCR peut utiliser GPU si disponible)

## 🐛 Dépannage

### Erreur "EasyOCR non disponible"

```bash
pip install easyocr
```

### Erreur "OpenCV non trouvé"

```bash
pip install opencv-python
```

### L'API ne démarre pas

```bash
pip install fastapi uvicorn python-multipart
```

### Image non détectée

- Vérifiez que l'image existe
- Vérifiez le format (JPG/PNG/BMP)
- Essayez d'améliorer la qualité de la photo

## 📚 Ressources

- [EasyOCR Documentation](https://github.com/JaidedAI/EasyOCR)
- [OpenCV Documentation](https://docs.opencv.org/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

- ✅ Support de tous les fonds
- ✅ API REST FastAPI
- ✅ CLI
- ✅ Validation stricte
