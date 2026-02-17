import pickle
import numpy as np
from lightfm import LightFM
from typing import List, Dict
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")

def calculate_match_score(driver: Dict, preferences: Dict) -> int:
    """Calcule le score de matching"""
    score = 0

    def bool_to_yesno(val):
        if isinstance(val, bool):
            return "yes" if val else "no"
        if val is None:
            return "no"
        return str(val).lower()

    # Quiet ride
    if preferences.get('quiet_ride') == 'yes' and bool_to_yesno(driver.get('talkative')) == 'no':
        score += 3
    elif preferences.get('quiet_ride') == 'no' and bool_to_yesno(driver.get('talkative')) == 'yes':
        score += 2

    # Radio
    if preferences.get('radio_ok') == 'yes' and bool_to_yesno(driver.get('radio_on')) == 'yes':
        score += 1
    elif preferences.get('radio_ok') == 'no' and bool_to_yesno(driver.get('radio_on')) == 'no':
        score += 1

    # Smoking
    if preferences.get('smoking_ok') == 'yes' and bool_to_yesno(driver.get('smoking_allowed')) == 'yes':
        score += 2
    elif preferences.get('smoking_ok') == 'no' and bool_to_yesno(driver.get('smoking_allowed')) == 'no':
        score += 2

    # Pets
    if preferences.get('pets_ok') == 'yes' and bool_to_yesno(driver.get('pets_allowed')) == 'yes':
        score += 2

    # Luggage
    if preferences.get('luggage_large') == 'yes' and bool_to_yesno(driver.get('car_big')) == 'yes':
        score += 2

    # Gender preference
    if preferences.get('female_driver_pref') == 'yes' and driver.get('sexe') == 'F':
        score += 1

    return score


class Recommender:
    def __init__(self):
        self.model = self.load_pickle("model_real/lightfm_model_real.pkl")
        self.dataset = self.load_pickle("model_real/dataset_real.pkl")
        self.user_features = self.load_pickle("model_real/user_features_real.pkl")
        self.item_features = self.load_pickle("model_real/item_features_real.pkl")
        self.user_id_map = self.load_pickle("model_real/user_id_map.pkl")
        self.driver_id_map = self.load_pickle("model_real/driver_id_map.pkl")
        self.index_to_driver_id = {v: k for k, v in self.driver_id_map.items()} if self.driver_id_map else {}


    def load_pickle(self, path: str):
        try:
            with open(path, "rb") as file:
                return pickle.load(file)
        except FileNotFoundError:
            print(f"[WARNING] Fichier non trouvé: {path}")
            return None


    async def get_all_drivers_from_db(self) -> List[Dict]:
        """Récupère tous les drivers depuis le backend Node.js"""
        try:
            #récupérer tous les drivers depuis la BD via le backend Node.js
            async with httpx.AsyncClient() as client: 
                response = await client.get(
                    f"{BACKEND_URL}/api/auth/driver/all", 
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    result = response.json()
                    drivers = result.get("data", result) if isinstance(result, dict) else result
                    print(f"✅ {len(drivers)} drivers récupérés depuis la DB")
                    return drivers
                
                else:
                    print(f"Erreur DB: status {response.status_code}")
                    return []
                
        except Exception as e:
            print(f"Erreur get_all_drivers: {e}")
            return []



    def predict_drivers(self, passenger_db_id: str) -> Dict[str, float]:
        """Retourne les scores LightFM"""
        
        if not self.model or not self.user_id_map or not self.driver_id_map:
            print("Modèle non chargé, retour cold start")
            return {}

        # S'assurer que l'ID commence par "P" (pour faire le mapping avec les IDs de la DB)
        if not passenger_db_id.startswith("P"):
            passenger_db_id = f"P{passenger_db_id}"

        if passenger_db_id not in self.user_id_map:
            print(f"Passager {passenger_db_id} inconnu du modèle (cold start)")
            return {}

        user_index = self.user_id_map[passenger_db_id]
        all_driver_indices = np.array(list(self.index_to_driver_id.keys()))

        scores = self.model.predict(
            user_index,
            all_driver_indices,
            user_features=self.user_features,
            item_features=self.item_features
        )

        return {self.index_to_driver_id[idx]: float(scores[i]) for i, idx in enumerate(all_driver_indices)}


# Instance globale
recommender = Recommender()


async def get_recommendations(passenger_id: str, preferences: Dict = {}, top_n: int = 10) -> List[Dict]:
    """
    Fonction principale de recommandation
    """
    print(f"\nRecherche recommandations pour passager: {passenger_id}")
    
    # S'assurer que l'ID commence par "P"
    if not passenger_id.startswith("P"):
        passenger_id = f"P{passenger_id}"
    
    # Scores LightFM
    lightfm_scores = recommender.predict_drivers(passenger_id)
    print(f"   Scores LightFM: {len(lightfm_scores)} drivers")

    # Récupérer drivers depuis DB
    all_drivers = await recommender.get_all_drivers_from_db()
    if not all_drivers:
        print("Aucun driver trouvé dans la DB")
        return []

    # Combiner scores
    for driver in all_drivers:
        driver_id = f"D{driver['id']}"
        lightfm_score = lightfm_scores.get(driver_id, 0.0)
        pref_score = calculate_match_score(driver, preferences) if preferences else 0

        # APRÈS — cold start ou nouveau passager : plus de poids aux prefs
        # Warm start (passager connu) : plus de poids au modèle
        is_warm = bool(lightfm_scores)  # True si le passager est connu du modèle

        if is_warm:
            driver['final_score'] = (0.7 * lightfm_score) + (0.3 * pref_score / 13)
        else:
            # Cold start : on se repose entièrement sur les préférences
            driver['final_score'] = pref_score / 13

    # Trier par score
    all_drivers.sort(key=lambda d: d.get('final_score', 0), reverse=True)

    # Supprimer final_score
    for driver in all_drivers:
        driver.pop('final_score', None)

    print(f"Retour de {min(top_n, len(all_drivers))} drivers")
    return all_drivers[:top_n]