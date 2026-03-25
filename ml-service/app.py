import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Union, Optional, List
from urllib.parse import urlparse
from dotenv import load_dotenv
from service.recommender import get_recommendations, add_feedback_to_buffer
from service import recommender

load_dotenv()

app = FastAPI(title="Driver Recommendation Service")


class RecommendationRequest(BaseModel):
    passenger_id:       Union[int, str]
    preferences:        Dict[str, Any]       = {}
    trajet:             Dict[str, Any]        = {}
    drivers:            List[Dict[str, Any]]  = []
    interaction_counts: Dict[str, int]        = {}
    top_n:              int                   = 5


# [FIX] Nouveau format : { rating, scores } au lieu de { rideId, driverId, rating }.
# L'ancien format cherchait un fichier log intermédiaire qui n'existe plus.
# Les scores arrivent directement depuis Express (lus en DB dans feedbackController).
class FeedbackRequest(BaseModel):
    rating: float                # note réelle 1–5
    scores: Dict[str, float]     # { lightfm, pref, dist, work, rating }


@app.post("/recommend")
async def recommend(data: RecommendationRequest):
    passenger_id    = f"P{data.passenger_id}"
    recommendations = await get_recommendations(
        passenger_id       = passenger_id,
        preferences        = data.preferences,
        trajet             = data.trajet,
        drivers            = data.drivers,
        interaction_counts = data.interaction_counts,
        top_n              = data.top_n,
    )
    return {
        "success":         True,
        "count":           len(recommendations),
        "recommendations": recommendations,
    }


@app.post("/feedback")
async def feedback(data: FeedbackRequest):
    """
    Reçoit la note réelle du passager + les scores ML du driver noté.
    Ajoute l'entrée au buffer de régression linéaire dans recommender.py.
    Body JSON :
      {
        "rating": 4.0,
        "scores": { "lightfm": 0.8, "pref": 0.6, "dist": 0.4, "work": 1.0, "rating": 0.75 }
      }
    """
    if not (1.0 <= data.rating <= 5.0):
        raise HTTPException(status_code=422, detail="rating doit être entre 1 et 5")

    # [FIX] add_feedback_to_buffer attend (scores, real_rating) — signature correcte.
    # L'ancienne version appelait (ride_id, driver_id, rating) ce qui crashait silencieusement.
    add_feedback_to_buffer(
        scores      = data.scores,
        real_rating = data.rating,
    )

    return {
        "success": True,
        "message": "Feedback enregistré dans le buffer de régression.",
        "target":  round((data.rating - 1) / 4, 4),
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/reload-model")
async def reload_model():
    recommender.recommender.reload()
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    raw_host = os.getenv("FAST_HOST", "0.0.0.0").strip()
    port     = int(os.getenv("FAST_PORT", 8000))

    if "://" in raw_host:
        parsed = urlparse(raw_host)
        host   = parsed.hostname or "0.0.0.0"
        if parsed.port and "FAST_PORT" not in os.environ:
            port = parsed.port
    else:
        host = raw_host

    uvicorn.run(app, host=host, port=port)