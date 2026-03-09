import pickle
import numpy as np
import pandas as pd
import math
from lightfm import LightFM
from typing import List, Dict, Optional
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")

# ── HAVERSINE ────────────────────────────────────────────────────────────────
def haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLng = math.radians(lng2 - lng1)
    a = (math.sin(dLat/2)**2 +
         math.cos(math.radians(lat1)) *
         math.cos(math.radians(lat2)) *
         math.sin(dLng/2)**2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── SCORE DISTANCE selon délai ────────────────────────────────────────────────
def score_distance(distance_km: float, hours_until_departure: float) -> float:
    if   hours_until_departure < 2:   reference_km = 15
    elif hours_until_departure < 24:  reference_km = 40
    elif hours_until_departure < 168: reference_km = 60
    else:                             reference_km = 80
    return 1 / (1 + distance_km / reference_km)


# ── SCORE HEURE DE TRAVAIL ────────────────────────────────────────────────────
def work_hour_match(driver: Dict, departure_hour: int) -> float:
    if departure_hour >= 5  and departure_hour < 12  and driver.get("works_morning"):   return 1.0
    if departure_hour >= 12 and departure_hour < 18  and driver.get("works_afternoon"): return 1.0
    if departure_hour >= 18 and departure_hour < 22  and driver.get("works_evening"):   return 1.0
    if (departure_hour >= 22 or departure_hour < 5)  and driver.get("works_night"):     return 1.0
    return 0.2


# ── DISTANCE BUCKET ───────────────────────────────────────────────────────────
def distance_bucket(km: float) -> str:
    if   km < 10:  return "dist:very_close"
    elif km < 30:  return "dist:close"
    elif km < 80:  return "dist:medium"
    elif km < 200: return "dist:far"
    else:          return "dist:very_far"


# ── SCORE MATCHING PRÉFÉRENCES ────────────────────────────────────────────────
def calculate_match_score(driver: Dict, preferences: Dict) -> float:
    score = 0
    max_score = 13

    def b(val):
        if isinstance(val, bool): return "yes" if val else "no"
        if val is None: return "no"
        return str(val).lower()

    if   preferences.get("quiet_ride") == "yes" and b(driver.get("talkative")) == "no":        score += 3
    elif preferences.get("quiet_ride") == "no"  and b(driver.get("talkative")) == "yes":       score += 2

    if   preferences.get("radio_ok") == "yes" and b(driver.get("radio_on")) == "yes":          score += 1
    elif preferences.get("radio_ok") == "no"  and b(driver.get("radio_on")) == "no":           score += 1

    if   preferences.get("smoking_ok") == "yes" and b(driver.get("smoking_allowed")) == "yes": score += 2
    elif preferences.get("smoking_ok") == "no"  and b(driver.get("smoking_allowed")) == "no":  score += 2

    if   preferences.get("pets_ok") == "yes" and b(driver.get("pets_allowed")) == "yes":       score += 2
    elif preferences.get("pets_ok") == "no"  and b(driver.get("pets_allowed")) == "no":        score += 2

    if   preferences.get("luggage_large") == "yes" and b(driver.get("car_big")) == "yes":      score += 2
    elif preferences.get("luggage_large") == "no"  and b(driver.get("car_big")) == "no":       score += 2

    if   preferences.get("female_driver_pref") == "yes" and driver.get("sexe") == "F":         score += 1
    elif preferences.get("female_driver_pref") == "no"  and driver.get("sexe") == "M":         score += 1

    return score / max_score


class Recommender:
    def __init__(self):
        self.model         = self._load("model_real/lightfm_model_real.pkl")
        self.dataset       = self._load("model_real/dataset_real.pkl")
        self.item_features = self._load("model_real/item_features_real.pkl")

        if self.dataset:
            user_id_map, _, item_id_map, _ = self.dataset.mapping()
            self.user_id_map        = user_id_map
            self.item_id_map        = item_id_map
            self.index_to_driver_id = {v: k for k, v in item_id_map.items()}
        else:
            self.user_id_map        = {}
            self.item_id_map        = {}
            self.index_to_driver_id = {}

        try:
            self.trajets_df = pd.read_csv("model_real/trajets_processed.csv")
            self.drivers_df = pd.read_csv("model_real/drivers_processed.csv")
            print(f"✅ {len(self.trajets_df)} trajets et {len(self.drivers_df)} drivers chargés")
        except Exception as e:
            print(f"[WARNING] CSV non trouvé: {e}")
            self.trajets_df = None
            self.drivers_df = None

    def _load(self, path: str):
        try:
            with open(path, "rb") as f:
                return pickle.load(f)
        except FileNotFoundError:
            print(f"[WARNING] Fichier non trouvé: {path}")
            return None

    async def get_all_drivers_from_db(self) -> List[Dict]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{BACKEND_URL}/api/auth/driver/all",
                    timeout=30.0
                )
                if response.status_code == 200:
                    result  = response.json()
                    drivers = result.get("data", result) if isinstance(result, dict) else result
                    print(f"✅ {len(drivers)} drivers récupérés depuis la DB")
                    return drivers
                print(f"Erreur DB: status {response.status_code}")
                return []
        except Exception as e:
            print(f"Erreur get_all_drivers: {e}")
            return []

    async def get_interaction_counts(self, passenger_id: str) -> Dict[str, int]:
        try:
            clean_id = passenger_id.replace("P", "")
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{BACKEND_URL}/api/passengers/{clean_id}/driver-interactions",
                    timeout=10.0
                )
                if response.status_code == 200:
                    counts = response.json().get("data", {})
                    print(f"✅ Historique: {len(counts)} drivers connus par ce passager")
                    return counts
                return {}
        except Exception as e:
            print(f"[WARNING] Interactions non disponibles: {e}")
            return {}

    def build_user_features_for_new_trajet(self, preferences: Dict,
                                            distance_km: float,
                                            hours_until_departure: float,
                                            departure_hour: int):
        if not self.dataset:
            return None

        db = distance_bucket(distance_km)
        features = [
            f"quiet_ride:{preferences.get('quiet_ride', 'no')}",
            f"radio_ok:{preferences.get('radio_ok', 'no')}",
            f"smoking_ok:{preferences.get('smoking_ok', 'no')}",
            f"pets_ok:{preferences.get('pets_ok', 'no')}",
            f"luggage_large:{preferences.get('luggage_large', 'no')}",
            f"female_driver_pref:{preferences.get('female_driver_pref', 'no')}",
            db,
            f"work_hour_match:0",
        ]

        try:
            _, user_feature_map, _, _ = self.dataset.mapping()
            feature_indices = []
            for feat in features:
                if feat in user_feature_map:
                    feature_indices.append(user_feature_map[feat])

            if not feature_indices:
                return None

            from scipy.sparse import csr_matrix
            n_features = len(user_feature_map)
            row = np.zeros(len(feature_indices), dtype=np.int32)
            col = np.array(feature_indices, dtype=np.int32)
            dat = np.ones(len(feature_indices), dtype=np.float32)
            return csr_matrix((dat, (row, col)), shape=(1, n_features))
        except Exception as e:
            print(f"[WARNING] build_user_features failed: {e}")
            return None

    def predict_cold_start(self, user_features_matrix) -> Dict[str, float]:
        if not self.model or user_features_matrix is None:
            return {}
        all_driver_indices = np.array(list(self.index_to_driver_id.keys()))
        scores = self.model.predict(
            0,
            all_driver_indices,
            user_features=user_features_matrix,
            item_features=self.item_features
        )
        return {self.index_to_driver_id[idx]: float(scores[i])
                for i, idx in enumerate(all_driver_indices)}


# Instance globale
recommender = Recommender()


async def get_recommendations(
    passenger_id: str,
    preferences: Dict = {},
    trajet: Dict = {},
    top_n: int = 5
) -> List[Dict]:

    print(f"\n🔍 Recommandations pour passager: {passenger_id}")

    # ── Infos du trajet ──────────────────────────────────────────────────────
    start_lat        = trajet.get("startLat")
    start_lng        = trajet.get("startLng")
    date_depart_str  = trajet.get("dateDepart")
    heure_depart_str = trajet.get("heureDepart", "12:00")
    departure_hour   = int(heure_depart_str.split(":")[0]) if heure_depart_str else 12

    hours_until_departure = 48.0
    if date_depart_str:
        try:
            from datetime import datetime, timezone
            date_depart = datetime.fromisoformat(date_depart_str.replace("Z", "+00:00"))
            now  = datetime.now(timezone.utc)
            diff = date_depart - now
            hours_until_departure = max(0.0, diff.total_seconds() / 3600)
        except Exception:
            pass

    print(f"   Heure départ: {departure_hour}h | Délai: {hours_until_departure:.1f}h")

    # ── Récupérer drivers + historique en parallèle ──────────────────────────
    import asyncio
    all_drivers, interaction_counts = await asyncio.gather(
        recommender.get_all_drivers_from_db(),
        recommender.get_interaction_counts(passenger_id),
    )

    if not all_drivers:
        return []

    # ── Scoring final ────────────────────────────────────────────────────────
    for driver in all_drivers:
        driver_id = f"D{driver['id']}"

        # 1. Distance réelle de CE driver
        dist_km    = 50.0
        dist_score = 0.5
        if start_lat and start_lng and driver.get("latitude") and driver.get("longitude"):
            try:
                dist_km    = haversine(driver["latitude"], driver["longitude"], start_lat, start_lng)
                dist_score = score_distance(dist_km, hours_until_departure)
                driver["distance_km"] = round(dist_km, 1)
            except Exception:
                pass

        # 2. LightFM avec vraie distance de CE driver
        lightfm_score    = 0.0
        user_feat_matrix = recommender.build_user_features_for_new_trajet(
            preferences, dist_km, hours_until_departure, departure_hour
        )
        if user_feat_matrix is not None:
            scores        = recommender.predict_cold_start(user_feat_matrix)
            lightfm_score = max(0.0, scores.get(driver_id, 0.0))

        # 3. Préférences
        pref_score = calculate_match_score(driver, preferences)

        # 4. Heure de travail
        work_score = work_hour_match(driver, departure_hour)

        # 5. Rating
        avg_rating   = driver.get("avgRating") or 4.0
        rating_score = (avg_rating - 1) / 4

        # Score final
        if user_feat_matrix is not None:
            final_score = (
                0.45 * lightfm_score +
                0.20 * pref_score    +
                0.15 * dist_score    +
                0.10 * work_score    +
                0.10 * rating_score
            )
        else:
            final_score = (
                0.40 * pref_score  +
                0.25 * dist_score  +
                0.20 * work_score  +
                0.15 * rating_score
            )

        # ── DIVERSIFICATION ───────────────────────────────────────────────
        nb_trajets_ensemble = interaction_counts.get(str(driver["id"]), 0)
        if nb_trajets_ensemble >= 5:
            final_score *= 0.80
            print(f"   🔄 Driver {driver['id']}: {nb_trajets_ensemble} trajets → score ×0.80")
        elif nb_trajets_ensemble >= 3:
            final_score *= 0.90
            print(f"   🔄 Driver {driver['id']}: {nb_trajets_ensemble} trajets → score ×0.90")

        driver["final_score"] = round(final_score, 4)
        driver["work_match"]  = work_score == 1.0
        driver["dist_score"]  = round(dist_score, 3)

    # ── Trier et retourner ───────────────────────────────────────────────────
    all_drivers.sort(key=lambda d: d.get("final_score", 0), reverse=True)

    for driver in all_drivers:
        driver.pop("final_score", None)

    print(f"✅ Top {min(top_n, len(all_drivers))} drivers retournés")
    return all_drivers[:top_n]