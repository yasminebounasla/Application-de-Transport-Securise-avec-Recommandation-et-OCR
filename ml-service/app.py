import os
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, Any
from service.recommender import get_recommendations

app = FastAPI(title="Driver Recommendation Service")

class RecommendationRequest(BaseModel):
    passenger_id: int
    preferences: Dict[str, Any] = {}

@app.post("/recommend")
async def recommend(data: RecommendationRequest):
    passenger_id = f"P{data.passenger_id}"
    
    recommendations = await get_recommendations(
        passenger_id=passenger_id,
        preferences=data.preferences,
        top_n=10
    )
    return {
        "success": True,
        "count": len(recommendations),
        "recommendations": recommendations
    }

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("FAST_HOST", "0.0.0.0")
    port = int(os.getenv("FAST_PORT", 8000))
    uvicorn.run(app, host=host, port=port)