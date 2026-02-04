import pickle
import numpy as np
from lightfm import LightFM
from typing import List, Dict
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
BACKEND_URL = os.getenv("BACKEND_URL")

class Recommender:
    def __init__(self):
        self.model: LightFM = self.load_pickle("model/lightfm_model.pkl")
        self.user_id_map = self.load_pickle("model/user_id_map.pkl")
        self.driver_id_map = self.load_pickle("model/driver_id_map.pkl")
        self.index_to_driver_id = (
            {v: k for k, v in self.driver_id_map.items()}
            if self.driver_id_map else {}
        )
    
    def load_pickle(self, path: str):
        try:
            with open(path, "rb") as file:
                return pickle.load(file)
        except FileNotFoundError:
            print(f"[WARNING] Fichier non trouvé: {path}")
            return None
   
    async def get_drivers_from_db(self, driver_ids: List[str]) -> List[Dict]:
        try:
            # Enlève le "D" : "D30" -> "30"
            clean_ids = [d[1:] for d in driver_ids]
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{BACKEND_URL}/api/driver/bulk",
                    json={"driver_ids": clean_ids},
                    timeout=30.0
                )
                if response.status_code == 200:
                    return response.json()
                else:
                    print(f"[ERROR] API status: {response.status_code}")
                    return []
        except Exception as e:
            print(f"[ERROR] Backend: {e}")
            return []
    
    def predict_drivers(self, passenger_db_id: str, top_n: int = 10) -> List[str]:
        if not self.model or not self.user_id_map or not self.driver_id_map:
            print("[WARNING] Modèle non chargé")
            return []
        
        if passenger_db_id not in self.user_id_map:
            print(f"[COLD START] Passenger {passenger_db_id} inconnu")
            return []
        
        try:
            user_index = self.user_id_map[passenger_db_id]
            all_driver_indices = np.array(list(self.index_to_driver_id.keys()))
            scores = self.model.predict(user_index, all_driver_indices)
            top_indices = all_driver_indices[np.argsort(-scores)][:top_n]
            top_driver_ids = [self.index_to_driver_id[idx] for idx in top_indices]
            return top_driver_ids
        except Exception as e:
            print(f"[ERROR] Prediction: {e}")
            return []

recommender = Recommender()

async def get_recommendations(passenger_id: str, preferences: Dict = {}, top_n: int = 10) -> List[Dict]:
    driver_ids = recommender.predict_drivers(passenger_id, top_n)
    if not driver_ids:
        return []
    
    drivers_data = await recommender.get_drivers_from_db(driver_ids)
    
    drivers_sorted = sorted(
        drivers_data,
        key=lambda d: driver_ids.index(f"D{d['id']}") if f"D{d['id']}" in driver_ids else 999
    )
    return drivers_sorted