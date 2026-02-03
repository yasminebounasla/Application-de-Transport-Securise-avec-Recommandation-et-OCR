import os
from fastapi import FastAPI
from pydantic import BaseModel
from recommender import get_recommendations

app = FastAPI()

# 🔹 Define expected request body
class RecommendationRequest(BaseModel):
    user_id: int
    preferences: dict


@app.post("/recommend")
def recommend(data: RecommendationRequest):
    recommendations = get_recommendations(data.user_id, data.preferences)
    return {"recommendations": recommendations}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("FLASK_PORT", 5000))
    uvicorn.run(app, host=os.getenv("FLASK_HOST", "127.0.0.1"), port=port)