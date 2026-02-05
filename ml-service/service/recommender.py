import pickle
import numpy as np
from lightfm import LightFM
from typing import List, Dict
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
BACKEND_URL = os.getenv("BACKEND_URL")

#algo de matching des préférences 
def calculate_match_score(driver: Dict, preferences: Dict) -> int:
    """Calcule un score de matching entre driver et préférences"""
    score = 0
    
    # Convertit bool → yes/no
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
        # Charge TOUT
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
        """Récupère TOUS les drivers disponibles dans la DB"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{BACKEND_URL}/api/auth/driver/all",
                    timeout=30.0
                )
                if response.status_code == 200:
                    result = response.json()
                    # Extrais "data" si c'est un wrapper
                    if isinstance(result, dict) and "data" in result:
                        return result["data"]
                    return result
                else:
                    print(f"[ERROR] get_all_drivers status: {response.status_code}")
                    return []
        except Exception as e:
            print(f"[ERROR] get_all_drivers: {e}")
            import traceback
            traceback.print_exc()
            return []

    def predict_drivers(self, passenger_db_id: str) -> Dict[str, float]:
        """Retourne les scores de tous les drivers pour un passenger"""
        if not self.model or not self.user_id_map or not self.driver_id_map:
            print("[WARNING] Modèle non chargé")
            return {}

        if passenger_db_id not in self.user_id_map:
            print(f"[COLD START] Passenger {passenger_db_id} inconnu")
            return {}

        try:
            user_index = self.user_id_map[passenger_db_id]
            all_driver_indices = np.array(list(self.index_to_driver_id.keys()))
            
            # ✅ AVEC LES FEATURES !
            scores = self.model.predict(
                user_index,
                all_driver_indices,
                user_features=self.user_features,
                item_features=self.item_features
            )
            
            return {self.index_to_driver_id[idx]: float(scores[i]) for i, idx in enumerate(all_driver_indices)}
        except Exception as e:
            print(f"[ERROR] predict_drivers: {e}")
            import traceback
            traceback.print_exc()
            return {}


# Instance globale
recommender = Recommender()


async def get_recommendations(passenger_id: str, preferences: Dict = {}, top_n: int = 5) -> List[Dict]:
    """
    Récupère les recommandations pour un passenger.
    Combine LightFM scores + matching de préférences.
    """
    print(f"\n{'='*60}")
    print(f"🔍 Recherche pour passenger: {passenger_id}")
    print(f"🎯 Préférences: {preferences}")
    print(f"{'='*60}\n")
    
    # 1️⃣ Obtenir les scores LightFM
    lightfm_scores = recommender.predict_drivers(passenger_id)
    
    print(f"📊 Nombre de scores LightFM: {len(lightfm_scores)}")
    if lightfm_scores:
        print(f"📊 Exemple de scores LightFM:")
        for driver_id, score in list(lightfm_scores.items())[:5]:
            print(f"   {driver_id}: {score:.4f}")
    else:
        print(f"⚠️ AUCUN score LightFM (cold start ou passenger inconnu)")

    # 2️⃣ Récupérer tous les drivers depuis la DB
    all_drivers = await recommender.get_all_drivers_from_db()
    
    if not all_drivers:
        print("❌ Aucun driver dans la DB!")
        return []
    
    print(f"\n✅ {len(all_drivers)} drivers récupérés de la DB\n")

    # 3️⃣ Combine LightFM score + preference matching
    for driver in all_drivers:
        driver_id = f"D{driver['id']}"
        
        # Score LightFM
        lightfm_score = lightfm_scores.get(driver_id, 0.0)
        
        # Score de matching des préférences
        pref_score = calculate_match_score(driver, preferences) if preferences else 0
        
        # Score final combiné (70% LightFM + 30% préférences)
        driver['final_score'] = (0.7 * lightfm_score) + (0.3 * pref_score / 13)
        
        # Print détaillé pour les 10 premiers
        if driver['id'] <= 25:
            print(f"D{driver['id']:2d} {driver['prenom']:8s} - LightFM: {lightfm_score:6.4f} | Pref: {pref_score:2d}/13 | Final: {driver['final_score']:.4f}")
    
    # 4️⃣ Trie par score final
    all_drivers.sort(key=lambda d: d.get('final_score', 0), reverse=True)
    
    print(f"\n🏆 Top {top_n} recommandés après tri:")
    for i, d in enumerate(all_drivers[:top_n], 1):
        print(f"  {i}. D{d['id']} {d['prenom']:8s} - Final Score: {d.get('final_score', 0):.4f}")
    
    print(f"{'='*60}\n")
    
    # Supprime le champ final_score avant de retourner
    for driver in all_drivers:
        driver.pop('final_score', None)
    
    return all_drivers[:top_n]