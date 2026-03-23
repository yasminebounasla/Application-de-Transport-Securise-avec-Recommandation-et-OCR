import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Union, Optional
from urllib.parse import urlparse
from dotenv import load_dotenv
from service.recommender import get_recommendations, add_feedback_to_buffer

load_dotenv()
app = FastAPI(title="Driver Recommendation Service")


class RecommendationRequest(BaseModel):
    passenger_id: Union[int, str]
    preferences: Dict[str, Any] = {}
    trajet: Dict[str, Any] = {}
    top_n: int = 5


class FeedbackRequest(BaseModel):
    rideId:   Union[int, str]
    driverId: Union[int, str]
    rating:   float   # note réelle 1–5


@app.post("/recommend")
async def recommend(data: RecommendationRequest):
    passenger_id = f"P{data.passenger_id}"

    recommendations = await get_recommendations(
        passenger_id=passenger_id,
        preferences=data.preferences,
        trajet=data.trajet,
        top_n=data.top_n,
    )
    return {
        "success": True,
        "count": len(recommendations),
        "recommendations": recommendations,
    }


@app.post("/feedback")
async def feedback(data: FeedbackRequest):
    """
    Reçoit le vrai rating passager après un trajet.
    Retrouve les scores loggés au moment de la recommandation
    et les ajoute au buffer de régression avec target = (rating-1)/4.

    Body JSON :
      {
        "rideId":   123,
        "driverId": 7,
        "rating":   4.0
      }
    """
    if not (1.0 <= data.rating <= 5.0):
        raise HTTPException(status_code=422, detail="rating doit être entre 1 et 5")

    ride_id   = str(data.rideId)
    driver_id = f"D{str(data.driverId).lstrip('D')}"

    success = add_feedback_to_buffer(ride_id, driver_id, data.rating)

    if not success:
        # Log non trouvé — on accepte quand même sans planter l'Express
        return {
            "success": False,
            "message": f"Aucun log de recommandation trouvé pour rideId={ride_id} driverId={driver_id}. "
                       "Le feedback n'a pas été ajouté au buffer.",
        }

    return {
        "success": True,
        "message": "Feedback enregistré dans le buffer de régression.",
        "rideId":   ride_id,
        "driverId": driver_id,
        "target":   round((data.rating - 1) / 4, 4),
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    raw_host = os.getenv("FAST_HOST", "0.0.0.0").strip()
    port = int(os.getenv("FAST_PORT", 8000))
    if "://" in raw_host:
        parsed = urlparse(raw_host)
        host = parsed.hostname or "0.0.0.0"
        if parsed.port and "FAST_PORT" not in os.environ:
            port = parsed.port
    else:
        host = raw_host
    uvicorn.run(app, host=host, port=port)