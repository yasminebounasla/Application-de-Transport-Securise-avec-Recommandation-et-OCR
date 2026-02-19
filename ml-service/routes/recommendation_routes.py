# routes/recommendations.py
from fastapi import APIRouter
from pydantic import BaseModel, Field
from services.recommender import get_recommendations

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


class Preferences(BaseModel):
    quiet_ride: str = Field(default="no", pattern="^(yes|no)$")
    radio_ok: str = Field(default="no", pattern="^(yes|no)$")
    smoking_ok: str = Field(default="no", pattern="^(yes|no)$")
    pets_ok: str = Field(default="no", pattern="^(yes|no)$")
    luggage_large: str = Field(default="no", pattern="^(yes|no)$")
    female_driver_pref: str = Field(default="no", pattern="^(yes|no)$")


class RecommendationRequest(BaseModel):
    passenger_id: str          # ID du passager (pour les logs / traçabilité)
    top_n: int = 10
    preferences: Preferences   # Préférences du TRAJET EN COURS


@router.post("/")
async def recommend_drivers(data: RecommendationRequest):
    """
    Recommande les meilleurs drivers pour un trajet donné.

    - passenger_id : ID du passager (pour traçabilité)
    - preferences  : préférences du passager pour CE trajet spécifique
    - top_n        : nombre de drivers à retourner

    Le modèle LightFM utilise les préférences du trajet comme user features
    pour prédire quels drivers correspondent le mieux.
    """
    # ✅ Correct (correspond à la signature dans recommender.py)
    drivers = await get_recommendations(
        passenger_id=data.passenger_id,
        preferences=data.preferences.dict(),
        top_n=data.top_n,
    )
    return {
        "passenger_id": data.passenger_id,
        "preferences": data.preferences.dict(),
        "recommended_drivers": drivers,
        "count": len(drivers),
    }