from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Optional, Any, List
from service.recommender import get_recommendations, add_feedback_to_buffer

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
    passenger_id:       str
    preferences:        Dict[str, Any]       = {}
    trajet:             TrajetPayload        = TrajetPayload()
    drivers:            List[Dict[str, Any]] = []
    interaction_counts: Dict[str, int]       = {}
    top_n:              int                  = 5


@router.post("/recommend")
async def recommend(payload: RecommendPayload):
    print(f"🐍 [/recommend] passenger={payload.passenger_id} | "
          f"drivers={len(payload.drivers)} | top_n={payload.top_n}")
    trajet_dict = payload.trajet.dict()
    try:
        drivers = await get_recommendations(
            passenger_id       = payload.passenger_id,
            preferences        = payload.preferences,
            trajet             = trajet_dict,
            drivers            = payload.drivers,
            interaction_counts = payload.interaction_counts,
            top_n              = payload.top_n,
        )
        return {"recommendations": drivers}
    except Exception as e:
        print(f"❌ [/recommend] Exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── FEEDBACK DIRECT ───────────────────────────────────────────────────────────
class FeedbackPayload(BaseModel):
    rating: float                    # note réelle 1–5
    scores: Dict[str, float]         # { lightfm, pref, dist, work, rating }
    # scores envoyés directement depuis Express avec le feedback
    # → plus besoin de fichier log intermédiaire


@router.post("/feedback")
async def feedback(payload: FeedbackPayload):
    print(f"📩 [/feedback] note={payload.rating} | scores={payload.scores}")
    try:
        add_feedback_to_buffer(
            scores      = payload.scores,
            real_rating = payload.rating,
        )
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── RELOAD MODÈLE ─────────────────────────────────────────────────────────────
from service.recommender import recommender

@router.post("/reload-model")
async def reload_model():
    recommender.reload()
    return {"status": "ok"}