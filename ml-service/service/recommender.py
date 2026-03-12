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
    """
    Plus le départ est imminent, plus on exige un driver proche.
    Formule : 1 / (1 + distance / reference)
    → 0.0 si très loin, → 1.0 si très proche
    """
    if   hours_until_departure < 2:   reference_km = 15   # départ immédiat → très proche
    elif hours_until_departure < 24:  reference_km = 40   # aujourd'hui → assez proche
    elif hours_until_departure < 168: reference_km = 60   # cette semaine → flexible
    else:                             reference_km = 80   # planifié → large rayon
    return 1 / (1 + distance_km / reference_km)


# ── PÉNALITÉ GÉOGRAPHIQUE SOUPLE ──────────────────────────────────────────────
def geo_penalty(distance_km: float, hours_until_departure: float) -> float:
    """
    Pénalise les drivers éloignés selon l'urgence du trajet.
    Maximum absolu : 100km — au-delà on pénalise fortement dans tous les cas.
    Retourne un multiplicateur entre 0.05 et 1.0.

    Logique :
    - Départ immédiat (< 2h)   : max toléré ~20km
    - Départ aujourd'hui       : max toléré ~40km
    - Départ cette semaine     : max toléré ~70km
    - Trajet planifié          : max toléré ~100km
    - Au-delà de 100km         : toujours fortement pénalisé
    """
    # ── Règle absolue : > 100km = pénalité forte peu importe le délai ────────
    if distance_km > 100:
        if distance_km > 80: return 0.05   # Constantine → Alger (~270km) : quasi éliminé
        return 0.10

    # ── Départ immédiat (< 2h) ────────────────────────────────────────────────
    if hours_until_departure < 2:
        if distance_km > 50:  return 0.10
        if distance_km > 30:  return 0.25
        if distance_km > 20:  return 0.50
        return 1.0

    # ── Départ aujourd'hui (2h – 24h) ─────────────────────────────────────────
    elif hours_until_departure < 24:
        if distance_km > 80:  return 0.10
        if distance_km > 60:  return 0.30
        if distance_km > 40:  return 0.60
        return 1.0

    # ── Départ cette semaine (1j – 7j) ────────────────────────────────────────
    elif hours_until_departure < 168:
        if distance_km > 100: return 0.10   # déjà géré au-dessus mais sécurité
        if distance_km > 80:  return 0.30
        if distance_km > 70:  return 0.60
        return 1.0

    # ── Trajet planifié longtemps à l'avance (> 7j) ───────────────────────────
    else:
        if distance_km > 100: return 0.10   # déjà géré au-dessus mais sécurité
        if distance_km > 85:  return 0.40
        if distance_km > 70:  return 0.70
        return 1.0


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

        # work_hour_match en fonction de l'heure de départ réelle
        # (on ne peut pas le calculer par driver ici, on met une valeur neutre)
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

    # ── Calcul LightFM UNE SEULE FOIS (distance neutre pour embeddings) ──────
    # On utilise une distance médiane pour les features LightFM car LightFM
    # apprend les préférences globales, pas la distance spécifique à chaque driver
    median_dist = 30.0
    user_feat_matrix = recommender.build_user_features_for_new_trajet(
        preferences, median_dist, hours_until_departure, departure_hour
    )
    lightfm_scores = {}
    if user_feat_matrix is not None:
        lightfm_scores = recommender.predict_cold_start(user_feat_matrix)
        print(f"   ✅ LightFM scores calculés pour {len(lightfm_scores)} drivers")
    else:
        print(f"   ⚠️  LightFM non disponible → fallback sur critères contextuels")

    # ── Scoring final pour chaque driver ────────────────────────────────────
    scored_drivers = []

    for driver in all_drivers:
        driver_id = f"D{driver['id']}"

        # 1. Distance réelle de CE driver vers le point de départ
        dist_km    = 50.0
        dist_score = 0.5
        penalty    = 1.0

        if start_lat and start_lng and driver.get("latitude") and driver.get("longitude"):
            try:
                dist_km    = haversine(driver["latitude"], driver["longitude"], start_lat, start_lng)
                dist_score = score_distance(dist_km, hours_until_departure)
                penalty    = geo_penalty(dist_km, hours_until_departure)
                driver["distance_km"] = round(dist_km, 1)
            except Exception:
                pass

        # 2. LightFM score (appris depuis les interactions passées)
        lightfm_score = max(0.0, lightfm_scores.get(driver_id, 0.0))

        # 3. Matching préférences
        pref_score = calculate_match_score(driver, preferences)

        # 4. Heure de travail
        work_score = work_hour_match(driver, departure_hour)

        # 5. Rating
        avg_rating   = driver.get("avgRating") or 4.0
        rating_score = (avg_rating - 1) / 4

        # ── Score final avec poids rééquilibrés ──────────────────────────────
        # LightFM : 45% (apprentissage collectif des préférences)
        # Préférences : 20% (matching direct passager ↔ driver)
        # Distance : 25% (proximité géographique — critique pour UX)
        # Heure : 05% (disponibilité horaire)
        # Rating : 05% (qualité historique)
        if lightfm_scores:
            final_score = (
                0.45 * lightfm_score +
                0.20 * pref_score    +
                0.25 * dist_score    +
                0.05 * work_score    +
                0.05 * rating_score
            )
        else:
            # Fallback si LightFM non disponible
            final_score = (
                0.40 * pref_score  +
                0.35 * dist_score  +
                0.15 * work_score  +
                0.10 * rating_score
            )

        # ── Pénalité géographique souple ─────────────────────────────────────
        # Multiplie le score final par un facteur entre 0.1 et 1.0
        # selon la distance et l'urgence du trajet
        # Ex: driver à 270km pour départ dans 1h → score × 0.10
        final_score *= penalty

        if penalty < 1.0:
            print(f"   📍 Driver {driver['id']} ({dist_km:.0f}km) → pénalité ×{penalty}")

        # ── Diversification ───────────────────────────────────────────────────
        # Réduire légèrement le score si passager a déjà beaucoup pris ce driver
        # → encourage la découverte de nouveaux profils compatibles
        nb_trajets_ensemble = interaction_counts.get(str(driver["id"]), 0)
        if nb_trajets_ensemble >= 5:
            final_score *= 0.80
            print(f"   🔄 Driver {driver['id']}: {nb_trajets_ensemble} trajets → ×0.80")
        elif nb_trajets_ensemble >= 3:
            final_score *= 0.90

        driver["final_score"] = round(final_score, 4)
        driver["work_match"]  = work_score == 1.0
        driver["dist_score"]  = round(dist_score, 3)
        driver["geo_penalty"] = penalty

        scored_drivers.append(driver)

    # ── Trier et retourner ───────────────────────────────────────────────────
    scored_drivers.sort(key=lambda d: d.get("final_score", 0), reverse=True)

    # Debug : afficher le top 10 avec distances
    print(f"\n   📊 Top 10 scores :")
    for d in scored_drivers[:10]:
        print(f"      Driver {d['id']} | dist: {d.get('distance_km', '?')}km "
              f"| penalty: {d.get('geo_penalty', 1):.2f} "
              f"| score: {d.get('final_score', 0):.4f}")

    # Nettoyer les champs internes avant de retourner
    for driver in scored_drivers:
        driver.pop("final_score", None)
        driver.pop("geo_penalty", None)

    print(f"\n✅ Top {min(top_n, len(scored_drivers))} drivers retournés")
    return scored_drivers[:top_n]