# recommendation_router.py  ── FastAPI router  (remplace ton endpoint /recommend actuel)
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Optional, Any
from service.recommender import get_recommendations   # ton fichier existant

router = APIRouter()


class TrajetPayload(BaseModel):
    startLat:    Optional[float] = None
    startLng:    Optional[float] = None
    endLat:      Optional[float] = None
    endLng:      Optional[float] = None
    distanceKm:  Optional[float] = None
    dateDepart:  Optional[str]   = None
    heureDepart: Optional[str]   = None
    rideId:      Optional[str]   = None


class RecommendPayload(BaseModel):
    passenger_id: str
    preferences:  Dict[str, Any] = {}
    trajet:       TrajetPayload  = TrajetPayload()   # ← OBJET SÉPARÉ maintenant
    top_n:        int            = 5


@router.post("/recommend")
async def recommend(payload: RecommendPayload):
    print("═══════════════════════════════════════════")
    print(f"🐍 [/recommend] passenger_id : {payload.passenger_id}")
    print(f"🐍 [/recommend] preferences  : {payload.preferences}")
    print(f"🐍 [/recommend] trajet       : {payload.trajet.dict()}")
    print(f"🐍 [/recommend] top_n        : {payload.top_n}")

    # ── Vérification géoloc ──────────────────────────────────────────────
    trajet_dict = payload.trajet.dict()

    if trajet_dict.get("startLat") is None or trajet_dict.get("startLng") is None:
        print("⚠️  [/recommend] startLat/startLng absents → distance désactivée")
    else:
        print(f"📍 [/recommend] startLat={trajet_dict['startLat']} "
              f"startLng={trajet_dict['startLng']}")

    print("═══════════════════════════════════════════")

    try:
        drivers = await get_recommendations(
            passenger_id = payload.passenger_id,
            preferences  = payload.preferences,
            trajet       = trajet_dict,      # ← bien passé comme dict séparé
            top_n        = payload.top_n,
        )
        return {"recommendations": drivers}

    except Exception as e:
        print(f"❌ [/recommend] Exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))