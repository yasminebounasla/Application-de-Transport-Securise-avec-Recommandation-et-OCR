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
        
        """Charge le modèle LightFM et les mappings au démarrage"""
        
        self.model: LightFM = self.load_pickle("models/lightfm_model.pkl")

        # Mappings sauvegardés pendant l'entraînement
        self.user_id_map = self.load_pickle("models/user_id_map.pkl")
        self.driver_id_map = self.load_pickle("models/driver_id_map.pkl")

        # Inverse mapping pour revenir vers les IDs réels DB
        self.index_to_driver_id = (
            {v: k for k, v in self.driver_id_map.items()}
            if self.driver_id_map else {}
        )

    def load_pickle(self, path: str):
        
        """Charge un fichier pickle"""
        
        try:
            with open(path, "rb") as file:  # rb = read binary
                return pickle.load(file)
            
        except FileNotFoundError:
            print(f"[WARNING] Fichier non trouvé: {path}")
            return None

   
    # APPEL BACKEND POUR INFOS DRIVERS
    
    async def get_drivers_from_db(self, driver_ids: List[str]) -> List[Dict]:
        
        """Récupère les infos complètes des drivers depuis le backend"""
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{BACKEND_URL}/api/drivers/bulk",
                    json={"driver_ids": driver_ids},
                    timeout=10.0
                )

                if response.status_code == 200:
                    return response.json()
                
                else:
                    print(f"[ERROR] API drivers status: {response.status_code}")
                    return []

        except Exception as e:
            print(f"[ERROR] Impossible de contacter backend: {e}")
            return []

    
    # PRÉDICTION LIGHTFM
    
    def predict_drivers(self, passenger_db_id: str, top_n: int = 5) -> List[str]:
        
        """Prédit les meilleurs drivers pour un passager donné"""

        if not self.model or not self.user_id_map or not self.driver_id_map:
            print("[WARNING] Modèle ou mappings non chargés")
            return []

        # 🔸 Vérifier si le passager existe dans le modèle
        if passenger_db_id not in self.user_id_map:
            print(f"[COLD START] Passenger inconnu: {passenger_db_id}")
            return []

        try:
            user_index = self.user_id_map[passenger_db_id]

            # Tous les drivers connus par le modèle
            all_driver_indices = np.array(list(self.index_to_driver_id.keys()))

            # Scores LightFM
            scores = self.model.predict(user_index, all_driver_indices)

            # Top N indices
            top_indices = all_driver_indices[np.argsort(-scores)][:top_n]

            # Convertir vers IDs réels DB
            top_driver_ids = [
                self.index_to_driver_id[idx] for idx in top_indices
            ]

            return top_driver_ids

        except Exception as e:
            print(f"[ERROR] Prediction failed: {e}")
            return []


# Instance globale
recommender = Recommender()



# FONCTION UTILISÉE PAR l'API

async def get_recommendations(passenger_id: str, top_n: int = 5) -> List[Dict]:
    
    """Retourne les drivers recommandés AVEC leurs infos complètes"""
    
    driver_ids = recommender.predict_drivers(passenger_id, top_n)

    if not driver_ids:
        return []

    drivers_data = await recommender.get_drivers_from_db(driver_ids)

    # Garder l'ordre de recommandation
    drivers_sorted = sorted(
        drivers_data,
        key=lambda d: driver_ids.index(d["id"]) if d["id"] in driver_ids else 999
    )

    return drivers_sorted
