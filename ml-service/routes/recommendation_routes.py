from fastapi import APIRouter
from pydantic import BaseModel
from services.recommender import get_recommendations

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


class RecommendationRequest(BaseModel):
    passenger_id: str
    top_n: int = 5


@router.post("/")
async def recommend_drivers(data: RecommendationRequest):
    drivers = await get_recommendations(data.passenger_id, data.top_n)
    return {"recommended_drivers": drivers}
