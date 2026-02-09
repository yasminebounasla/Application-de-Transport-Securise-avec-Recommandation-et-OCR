from fastapi import APIRouter
from pydantic import BaseModel
from services.recommender import get_recommendations

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])

# Modèle de données pour les préférences du passager
class Preferences(BaseModel):
    quiet_ride: str
    radio_ok: str
    smoking_ok: str
    pets_ok: str
    luggage_large: str
    female_driver_pref: str

class RecommendationRequest(BaseModel):
    passenger_id: str
    top_n: int = 5
    preferences: Preferences  # ajoute preferences

@router.post("/")
async def recommend_drivers(data: RecommendationRequest):
    
    # Appelle ton service avec passenger_id et preferences
    drivers = await get_recommendations(
        data.passenger_id,
        data.top_n,
        data.preferences.dict()  # converti Pydantic object en dict pour la compatibilité avec le service de recommandation
    )
    return {"recommended_drivers": drivers}
