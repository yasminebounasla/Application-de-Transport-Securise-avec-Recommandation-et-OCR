import pickle
import numpy as np
from lightfm import LightFM
from typing import List, Dict
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
BACKEND_URL = os.getenv("BACKEND_URL")


# =========================
# Helper : calcul score selon préférences
# =========================

def calculate_match_score(driver: Dict, preferences: Dict) -> int:
    """
    Calcule un score simple de matching entre un driver et les préférences du passenger.
    Booléens et None sont convertis en 'yes' / 'no' pour comparer proprement.
    """
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


# =========================
# Classe Recommender
# =========================
class Recommender:
    def __init__(self):
        """
        Charge tous les modèles et mappings pickle pour le LightFM.
        self.index_to_driver_id sert à retrouver l'ID réel du driver depuis l'index LightFM.
        """
        self.model = self.load_pickle("model_real/lightfm_model_real.pkl")
        self.dataset = self.load_pickle("model_real/dataset_real.pkl")
        self.user_features = self.load_pickle("model_real/user_features_real.pkl")
        self.item_features = self.load_pickle("model_real/item_features_real.pkl")
        self.user_id_map = self.load_pickle("model_real/user_id_map.pkl")
        self.driver_id_map = self.load_pickle("model_real/driver_id_map.pkl")

        # mapping index LightFM → driver_id réel
        self.index_to_driver_id = {v: k for k, v in self.driver_id_map.items()} if self.driver_id_map else {}

    def load_pickle(self, path: str):
        """Charge un fichier pickle, retourne None si absent"""
        try:
            with open(path, "rb") as file:
                return pickle.load(file)
        except FileNotFoundError:
            print(f"[WARNING] Fichier non trouvé: {path}")
            return None

    async def get_all_drivers_from_db(self) -> List[Dict]:
        """Récupère tous les drivers depuis le backend pour avoir infos complètes et IDs réels"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{BACKEND_URL}/api/auth/driver/all", timeout=30.0)
                if response.status_code == 200:
                    result = response.json()
                    return result.get("data", result) if isinstance(result, dict) else result
                else:
                    print(f"[ERROR] get_all_drivers status: {response.status_code}")
                    return []
        except Exception as e:
            print(f"[ERROR] get_all_drivers: {e}")
            import traceback
            traceback.print_exc()
            return []

    def predict_drivers(self, passenger_db_id: str) -> Dict[str, float]:
        """
        Retourne les scores LightFM pour tous les drivers d'un passenger.
        Si passenger inconnu → cold start.
        """
        if not self.model or not self.user_id_map or not self.driver_id_map:
            return {}

        if passenger_db_id not in self.user_id_map:
            # Passenger jamais vu par LightFM
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


# Instance globale pour éviter de recharger le modèle à chaque appel
recommender = Recommender()


# =========================
# Fonction principale de recommandation
# =========================

async def get_recommendations(passenger_id: str, preferences: Dict = {}, top_n: int = 5) -> List[Dict]:
    """
    Retourne les top_n drivers recommandés pour un passenger.
    Combine score LightFM + score matching des préférences.
    """
    # Scores LightFM
    lightfm_scores = recommender.predict_drivers(passenger_id)

    # Récupère les drivers depuis la DB
    all_drivers = await recommender.get_all_drivers_from_db()
    if not all_drivers:
        return []

    # Combine LightFM + matching des préférences
    for driver in all_drivers:
        driver_id = f"D{driver['id']}"
        lightfm_score = lightfm_scores.get(driver_id, 0.0)
        pref_score = calculate_match_score(driver, preferences) if preferences else 0

        # Score final : 70% LightFM + 30% preferences (normalisé)
        driver['final_score'] = (0.7 * lightfm_score) + (0.3 * pref_score / 13)

    # Trie par score final
    all_drivers.sort(key=lambda d: d.get('final_score', 0), reverse=True)

    # Supprime final_score avant retour
    for driver in all_drivers:
        driver.pop('final_score', None)

    # Retourne top_n
    return all_drivers[:top_n]
