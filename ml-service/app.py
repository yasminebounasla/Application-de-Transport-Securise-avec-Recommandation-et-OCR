import os
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, Any, Union
from urllib.parse import urlparse
from dotenv import load_dotenv
from service.recommender import get_recommendations

load_dotenv()

app = FastAPI(title="Driver Recommendation Service")

class RecommendationRequest(BaseModel):
    passenger_id: Union[int, str]
    preferences: Dict[str, Any] = {}
    top_n: int = 5

@app.post("/recommend")
async def recommend(data: RecommendationRequest):
    passenger_id = f"P{data.passenger_id}"
    
    recommendations = await get_recommendations(
        passenger_id=passenger_id,
        preferences=data.preferences,
        top_n=5
    )
    return {
        "success": True,
        "count": len(recommendations),
        "recommendations": recommendations
    }

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
