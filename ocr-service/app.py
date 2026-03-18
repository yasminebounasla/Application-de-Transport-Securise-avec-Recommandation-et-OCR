# API Flask pour OCR

# Instructions pour exécuter le service OCR :
# cd ocr-service
# conda env create -f env.yml
# conda activate ocr-env
# python app.py
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🚗 API FastAPI pour extraction de permis de conduire
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
from pathlib import Path
from ocr_utils import process_driving_license

app = FastAPI(
    title="Driving License OCR API",
    description="API d'extraction des informations du permis de conduire algérien",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Page d'accueil de l'API"""
    return {
        "message": "🚗 Driving License OCR API",
        "version": "1.0.0",
        "endpoints": {
            "extract": "/extract - POST - Upload d'image pour extraction",
            "health": "/health - GET - Vérification de l'état de l'API"
        }
    }


@app.get("/health")
async def health():
    """Endpoint de santé"""
    return {"status": "ok", "service": "driving-license-ocr"}


@app.post("/extract")
async def extract_license(file: UploadFile = File(...)):
    """
    Extraction des informations du permis de conduire
    
    Args:
        file: Image du permis (JPG, PNG, JPEG)
        
    Returns:
        JSON avec les informations extraites
    """
    # Vérifier l'extension
    valid_extensions = ['.jpg', '.jpeg', '.png', '.bmp']
    file_ext = Path(file.filename).suffix.lower()
    
    if file_ext not in valid_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Format non supporté: {file_ext}. Formats acceptés: {', '.join(valid_extensions)}"
        )
    
    # Sauvegarder temporairement
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # Traiter l'image
        result = process_driving_license(tmp_path)
        
        # Nettoyer
        os.unlink(tmp_path)
        
        if result:
            # Retirer raw_text pour alléger la réponse
            result_clean = result.copy()
            result_clean.pop('raw_text', None)
            
            return JSONResponse(content={
                "success": True,
                "data": result_clean
            })
        else:
            raise HTTPException(
                status_code=500,
                detail="Échec de l'extraction des informations"
            )
            
    except Exception as e:
        # Nettoyer en cas d'erreur
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors du traitement: {str(e)}"
        )


@app.post("/extract/batch")
async def extract_licenses_batch(files: list[UploadFile] = File(...)):
    """
    Extraction batch de plusieurs permis
    
    Args:
        files: Liste d'images de permis
        
    Returns:
        JSON avec les résultats pour chaque image
    """
    if len(files) > 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 images par requête"
        )
    
    results = []
    
    for file in files:
        try:
            # Vérifier l'extension
            valid_extensions = ['.jpg', '.jpeg', '.png', '.bmp']
            file_ext = Path(file.filename).suffix.lower()
            
            if file_ext not in valid_extensions:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "error": f"Format non supporté: {file_ext}"
                })
                continue
            
            # Traiter
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
                content = await file.read()
                tmp_file.write(content)
                tmp_path = tmp_file.name
            
            result = process_driving_license(tmp_path)
            os.unlink(tmp_path)
            
            if result:
                result_clean = result.copy()
                result_clean.pop('raw_text', None)
                
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "data": result_clean
                })
            else:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "error": "Échec de l'extraction"
                })
                
        except Exception as e:
            if 'tmp_path' in locals() and os.path.exists(tmp_path):
                os.unlink(tmp_path)
            
            results.append({
                "filename": file.filename,
                "success": False,
                "error": str(e)
            })
    
    return JSONResponse(content={
        "success": True,
        "total": len(files),
        "processed": len(results),
        "results": results
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
