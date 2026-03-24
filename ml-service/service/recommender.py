import pickle
import numpy as np
import pandas as pd
import math
import json
import os
from lightfm import LightFM
from typing import List, Dict, Optional
import httpx
from dotenv import load_dotenv
from scipy.sparse import csr_matrix
from scipy.optimize import minimize

load_dotenv()
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "model_real")
LOGS_PATH  = os.path.join(BASE_DIR, "..", "recommendation_logs.jsonl")


# ── HAVERSINE ─────────────────────────────────────────────────────────────────
def haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLng = math.radians(lng2 - lng1)
    a = (math.sin(dLat/2)**2 +
         math.cos(math.radians(lat1)) *
         math.cos(math.radians(lat2)) *
         math.sin(dLng/2)**2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def score_distance(distance_km: float, hours_until_departure: float) -> float:
    if   hours_until_departure < 2:   reference_km = 15
    elif hours_until_departure < 24:  reference_km = 40
    elif hours_until_departure < 168: reference_km = 60
    else:                             reference_km = 80
    return math.exp(-distance_km / reference_km)


def work_hour_match(driver: Dict, departure_hour: int) -> float:
    if departure_hour >= 5  and departure_hour < 12  and driver.get("works_morning"):   return 1.0
    if departure_hour >= 12 and departure_hour < 18  and driver.get("works_afternoon"): return 1.0
    if departure_hour >= 18 and departure_hour < 22  and driver.get("works_evening"):   return 1.0
    if (departure_hour >= 22 or departure_hour < 5)  and driver.get("works_night"):     return 1.0
    return 0.2


def distance_bucket(km: float) -> str:
    if   km < 10:  return "dist:very_close"
    elif km < 30:  return "dist:close"
    elif km < 80:  return "dist:medium"
    elif km < 200: return "dist:far"
    else:          return "dist:very_far"


def max_driver_distance(trajet_distance_km: float, hours_until_departure: float) -> float:
    if   trajet_distance_km < 30:   dist_based = 30
    elif trajet_distance_km < 100:  dist_based = 60
    elif trajet_distance_km < 300:  dist_based = 100
    else:                           dist_based = 150

    if   hours_until_departure < 1:   time_based = 15
    elif hours_until_departure < 3:   time_based = 30
    elif hours_until_departure < 24:  time_based = 60
    else:                             time_based = dist_based

    return min(dist_based, time_based)


# ── calculate_match_score ─────────────────────────────────────────────────────
# 3 états possibles par critère :
#   - Préférence non renseignée          → ignorée (neutre, pas dans le calcul)
#   - Préférence renseignée + match      → +points (bonus)
#   - Préférence renseignée + mismatch   → -points (pénalité)
# Normalisation finale : (score + max) / (2 * max) → toujours entre 0 et 1
#   worst case : tous mismatch → 0.0
#   best  case : tous match    → 1.0
#   aucune préférence          → 0.5 neutre
def calculate_match_score(driver: Dict, preferences: Dict) -> float:

    def b(val):
        if isinstance(val, bool): return "yes" if val else "no"
        if val is None: return "no"
        return str(val).lower()

    score      = 0.0
    max_points = 0.0

    # ── Critères forts (±2) ───────────────────────────────────────────────────

    pref = preferences.get("female_driver_pref")
    if pref in ("yes", "no"):
        max_points += 2
        match = (pref == "yes" and driver.get("sexe") == "F") or \
                (pref == "no"  and driver.get("sexe") == "M")
        score += 2 if match else -2

    pref = preferences.get("smoking_ok")
    if pref in ("yes", "no"):
        max_points += 2
        match = (pref == "yes" and b(driver.get("smoking_allowed")) == "yes") or \
                (pref == "no"  and b(driver.get("smoking_allowed")) == "no")
        score += 2 if match else -2

    pref = preferences.get("luggage_large")
    if pref in ("yes", "no"):
        max_points += 2
        match = (pref == "yes" and b(driver.get("car_big")) == "yes") or \
                (pref == "no"  and b(driver.get("car_big")) == "no")
        score += 2 if match else -2

    pref = preferences.get("pets_ok")
    if pref in ("yes", "no"):
        max_points += 2
        match = (pref == "yes" and b(driver.get("pets_allowed")) == "yes") or \
                (pref == "no"  and b(driver.get("pets_allowed")) == "no")
        score += 2 if match else -2

    # ── Critères légers (±1) ──────────────────────────────────────────────────

    pref = preferences.get("quiet_ride")
    if pref in ("yes", "no"):
        max_points += 1
        match = (pref == "yes" and b(driver.get("talkative")) == "no") or \
                (pref == "no"  and b(driver.get("talkative")) == "yes")
        score += 1 if match else -1

    pref = preferences.get("radio_ok")
    if pref in ("yes", "no"):
        max_points += 1
        match = (pref == "yes" and b(driver.get("radio_on")) == "yes") or \
                (pref == "no"  and b(driver.get("radio_on")) == "no")
        score += 1 if match else -1

    if max_points == 0:
        return 0.5  # aucune préférence → neutre

    # Normalise [-max_points, +max_points] → [0.0, 1.0]
    return (score + max_points) / (2 * max_points)


# ── COLD START ────────────────────────────────────────────────────────────────
def cold_start_by_preferences(
    drivers: List[Dict],
    preferences: Dict,
    departure_hour: int,
    hours_until_departure: float,
    start_lat: float,
    start_lng: float,
    max_km: float,
    top_n: int = 5
) -> List[Dict]:
    geo_available = start_lat is not None and start_lng is not None
    scored = []

    for driver in drivers:
        if geo_available and driver.get("latitude") and driver.get("longitude"):
            try:
                dist_km = haversine(driver["latitude"], driver["longitude"], start_lat, start_lng)
                driver["distance_km"] = round(dist_km, 1)
            except Exception:
                dist_km = None
        else:
            dist_km = None

        if dist_km is not None and dist_km > max_km:
            continue

        pref_score   = calculate_match_score(driver, preferences)
        dist_score   = score_distance(dist_km, hours_until_departure) if dist_km is not None else 0.5
        work_score   = work_hour_match(driver, departure_hour)
        avg_rating   = driver.get("avgRating") or 4.0
        rating_score = (avg_rating - 1) / 4

        if geo_available:
            final_score = (
                0.50 * pref_score   +
                0.25 * dist_score   +
                0.15 * work_score   +
                0.10 * rating_score
            )
        else:
            final_score = (
                0.60 * pref_score   +
                0.25 * work_score   +
                0.15 * rating_score
            )

        driver["final_score"] = round(final_score, 4)
        driver["work_match"]  = work_score == 1.0
        driver["dist_score"]  = round(dist_score, 3) if dist_km is not None else None
        scored.append(driver)

    scored.sort(key=lambda d: d.get("final_score", 0), reverse=True)
    for d in scored:
        d.pop("final_score", None)

    print(f"✅ Cold-start: {len(scored)} drivers filtrés | Top {min(top_n, len(scored))} retournés")
    return scored[:top_n]


# ── LOG DES SCORES ─────────────────────────────────────────────────────────────
def save_recommendation_log(ride_id: str, driver_id: str, scores: Dict) -> None:
    entry = {
        "rideId":   ride_id,
        "driverId": driver_id,
        "lightfm":  scores["lightfm"],
        "pref":     scores["pref"],
        "dist":     scores["dist"],
        "work":     scores["work"],
        "rating":   scores["rating"],
    }
    try:
        with open(LOGS_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as e:
        print(f"[WARNING] Impossible de sauvegarder le log: {e}")



def find_log_entry(ride_id: str, driver_id: str) -> Optional[Dict]:
    if not os.path.exists(LOGS_PATH):
        return None
    try:
        matches = []
        with open(LOGS_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    if (entry.get("rideId") == str(ride_id) and
                            entry.get("driverId") == str(driver_id)):
                        matches.append(entry)
                except json.JSONDecodeError:
                    continue
        return matches[-1] if matches else None
    except Exception as e:
        print(f"[WARNING] Lecture log échouée: {e}")
        return None


# ── OPTIMISATION POIDS AVEC BOUNDS ───────────────────────────────────────────
_scores_history: List[Dict] = []
_optimized_weights: Optional[np.ndarray] = None

WEIGHT_BOUNDS = {
    "lightfm": (0.20, 0.50),
    "pref":    (0.20, 0.45),
    "dist":    (0.10, 0.35),
    "work":    (0.05, 0.20),
    "rating":  (0.02, 0.15),
}
WEIGHT_KEYS = ["lightfm", "pref", "dist", "work", "rating"]

# FIX : poids rééquilibrés — LightFM reste le moteur principal (0.35),
# mais Pref monte à 0.45 pour que les préférences temps réel renforcent
# vraiment le résultat. Avant : LFM=0.30/Pref=0.45 → LFM dominait car
# Pref était écrasé par base**2. Maintenant que Pref est linéaire et bien
# calibré, 0.45 lui donne un vrai pouvoir de différenciation.
DEFAULT_WEIGHTS_GEO    = np.array([0.35, 0.45, 0.08, 0.08, 0.04])
DEFAULT_WEIGHTS_NO_GEO = np.array([0.35, 0.45, 0.00, 0.13, 0.07])


def _try_optimize_weights() -> Optional[np.ndarray]:
    if len(_scores_history) < 50:
        return None
    try:
        df = pd.DataFrame(_scores_history)
        X  = df[WEIGHT_KEYS].values
        y  = df["target"].values

        def loss(w):
            return np.mean((X @ w - y) ** 2)

        def grad(w):
            return 2 * X.T @ (X @ w - y) / len(y)

        bounds      = [WEIGHT_BOUNDS[k] for k in WEIGHT_KEYS]
        constraints = {"type": "eq", "fun": lambda w: w.sum() - 1}
        w0          = DEFAULT_WEIGHTS_GEO.copy()

        result = minimize(
            loss, w0, jac=grad,
            method="SLSQP",
            bounds=bounds,
            constraints=constraints,
            options={"ftol": 1e-9, "maxiter": 1000},
        )

        if not result.success:
            print(f"[WARNING] Optimisation poids échouée: {result.message} — hardcodés conservés")
            return None

        w_norm = result.x
        print(f"\n📊 Poids optimisés avec bounds ({len(_scores_history)} obs) :")
        for k, v in zip(WEIGHT_KEYS, w_norm):
            lo, hi = WEIGHT_BOUNDS[k]
            print(f"   {k:10s}: {v:.3f}  [{lo}, {hi}]")

        return w_norm

    except Exception as e:
        print(f"[WARNING] Régression échouée: {e}")
        return None


def add_feedback_to_buffer(ride_id: str, driver_id: str, real_rating: float) -> bool:
    global _optimized_weights

    entry = find_log_entry(ride_id, driver_id)
    if not entry:
        print(f"[WARNING] Aucun log trouvé pour rideId={ride_id} driverId={driver_id}")
        return False

    # target = note réelle normalisée 0→1 (1★ = 0.0, 5★ = 1.0)
    # C'est le vrai signal : l'optimiseur apprend quels scores composantes
    # prédisent le mieux la satisfaction réelle du passager.
    target = max(0.0, min(1.0, (real_rating - 1) / 4))

    _scores_history.append({
        "lightfm": entry["lightfm"],
        "pref":    entry["pref"],
        "dist":    entry["dist"],
        "work":    entry["work"],
        "rating":  entry["rating"],
        "target":  target,
    })

    print(f"✅ Feedback ajouté | rideId={ride_id} | driver={driver_id} | "
          f"note={real_rating} → target={target:.3f} | buffer={len(_scores_history)}/50")

    # Déclenche l'optimisation dès 50 observations
    if len(_scores_history) >= 50:
        new_weights = _try_optimize_weights()
        if new_weights is not None:
            _optimized_weights = new_weights
            print(f"🎯 Poids mis à jour automatiquement après {len(_scores_history)} feedbacks")

    return True


# ── RECOMMENDER CLASS ─────────────────────────────────────────────────────────
class Recommender:
    def __init__(self):
        self.model         = self._load(os.path.join(MODELS_DIR, "lightfm_model_real.pkl"))
        self.dataset       = self._load(os.path.join(MODELS_DIR, "dataset_real.pkl"))
        self.item_features = self._load(os.path.join(MODELS_DIR, "item_features_real.pkl"))
        self.user_features = self._load(os.path.join(MODELS_DIR, "user_features_real.pkl"))

        if self.dataset:
            user_id_map, user_feature_map, item_id_map, _ = self.dataset.mapping()
            self.user_id_map        = user_id_map
            self.user_feature_map   = user_feature_map
            self.item_id_map        = item_id_map
            self.index_to_driver_id = {v: k for k, v in item_id_map.items()}
        else:
            self.user_id_map        = {}
            self.user_feature_map   = {}
            self.item_id_map        = {}
            self.index_to_driver_id = {}

        try:
            self.drivers_df = pd.read_csv(os.path.join(MODELS_DIR, "drivers_processed.csv"))
            print(f"✅ {len(self.drivers_df)} drivers chargés")
        except Exception as e:
            print(f"[WARNING] CSV non trouvé: {e}")
            self.drivers_df = None

    def _load(self, path: str):
        try:
            print(f"   [LOAD] Tentative: {path}")
            with open(path, "rb") as f:
                obj = pickle.load(f, encoding="bytes")
            print(f"   [LOAD] ✅ OK: {path} → type={type(obj).__name__}")
            return obj
        except Exception as e1:
            try:
                import joblib
                obj = joblib.load(path)
                print(f"   [LOAD] ✅ OK (joblib): {path} → type={type(obj).__name__}")
                return obj
            except Exception as e2:
                print(f"   [LOAD] ❌ ERREUR: {path}")
                print(f"   [LOAD]    pickle : {e1}")
                print(f"   [LOAD]    joblib : {e2}")
                return None

    async def get_all_drivers_from_db(self) -> List[Dict]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{BACKEND_URL}/api/auth/driver/all", timeout=30.0
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
            clean_id = str(passenger_id).lstrip("P")
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{BACKEND_URL}/api/passengers/{clean_id}/driver-interactions",
                    timeout=10.0,
                )
                if response.status_code == 200:
                    counts = response.json().get("data", {})
                    print(f"✅ Historique: {len(counts)} drivers connus par ce passager")
                    return counts
                return {}
        except Exception as e:
            print(f"[WARNING] Interactions non disponibles: {e}")
            return {}

    def build_user_features_matrix(self, features_list: List[str]) -> Optional[csr_matrix]:
        if not self.dataset:
            return None
        try:
            feature_indices = [
                self.user_feature_map[f]
                for f in features_list
                if f in self.user_feature_map
            ]
            if not feature_indices:
                return None
            n_features = len(self.user_feature_map)
            row = np.zeros(len(feature_indices), dtype=np.int32)
            col = np.array(feature_indices, dtype=np.int32)
            dat = np.ones(len(feature_indices), dtype=np.float32)
            return csr_matrix((dat, (row, col)), shape=(1, n_features))
        except Exception as e:
            print(f"[WARNING] build_user_features_matrix failed: {e}")
            return None

    def predict_for_passenger(self, passenger_key: str) -> Dict[str, float]:
        """
        Scores LightFM normalisés via softmax (température=1.0).
        LightFM est le moteur principal — il capture les patterns comportementaux
        profonds (quel type de driver ce passager choisit historiquement).
        Les autres composantes (Pref, Dist, Work, Rating) renforcent le signal
        avec le contexte temps réel du trajet en cours.
        """
        if not self.model:
            return {}

        all_driver_indices = np.array(list(self.index_to_driver_id.keys()))
        user_index         = self.user_id_map[passenger_key]
        print(f"   Mode LightFM: CF hybride (passager {passenger_key} connu)")

        try:
            raw_scores = self.model.predict(
                user_index,
                all_driver_indices,
                user_features=self.user_features,
                item_features=self.item_features,
            )
        except Exception as e:
            print(f"[WARNING] predict avec user_features failed: {e} — fallback sans")
            try:
                raw_scores = self.model.predict(
                    user_index,
                    all_driver_indices,
                    user_features=None,
                    item_features=self.item_features,
                )
            except Exception as e2:
                print(f"[WARNING] predict fallback failed: {e2}")
                return {}

        temperature = 1.0
        shifted     = raw_scores - raw_scores.max()
        exp_scores  = np.exp(shifted / temperature)
        scores_soft = exp_scores / exp_scores.sum()

        s_min, s_max = scores_soft.min(), scores_soft.max()
        if s_max > s_min:
            scores_norm = (scores_soft - s_min) / (s_max - s_min)
        else:
            scores_norm = np.zeros_like(scores_soft)

        print(f"   [DEBUG] raw: min={raw_scores.min():.3f} max={raw_scores.max():.3f} | "
              f"softmax_norm: min={scores_norm.min():.3f} max={scores_norm.max():.3f}")

        return {
            self.index_to_driver_id[idx]: float(scores_norm[i])
            for i, idx in enumerate(all_driver_indices)
        }


# Instance globale
recommender = Recommender()


# ── POINT D'ENTRÉE PRINCIPAL ──────────────────────────────────────────────────
async def get_recommendations(
    passenger_id: str,
    preferences: Dict = None,
    trajet: Dict = None,
    drivers: List[Dict] = None,
    interaction_counts: Dict = None,
    top_n: int = 5
) -> List[Dict]:

    preferences = preferences or {}
    trajet      = trajet      or {}

    print(f"\n🔍 Recommandations pour passager: {passenger_id}")

    start_lat     = trajet.get("startLat")
    start_lng     = trajet.get("startLng")
    geo_available = start_lat is not None and start_lng is not None

    if not geo_available:
        print(f"   [WARNING] startLat/startLng absents → filtrage distance désactivé, "
              f"dist_score=0.5 (neutre) pour tous les drivers")

    trajet_distance_km = float(trajet.get("distanceKm") or 50.0)
    date_depart_str    = trajet.get("dateDepart")
    heure_depart_str   = trajet.get("heureDepart", "12:00")
    departure_hour     = int(heure_depart_str.split(":")[0]) if heure_depart_str else 12

    ride_id = str(trajet.get("rideId", ""))
    if not ride_id:
        import time
        ride_id = f"{passenger_id}_{int(time.time())}"
        print(f"   [WARNING] rideId absent — fallback: {ride_id}")

    hours_until_departure = 48.0
    if date_depart_str:
        try:
            from datetime import datetime, timezone
            date_depart = datetime.fromisoformat(date_depart_str.replace("Z", "+00:00"))
            now         = datetime.now(timezone.utc)
            diff        = date_depart - now
            hours_until_departure = max(0.0, diff.total_seconds() / 3600)
        except Exception:
            pass

    max_km = max_driver_distance(trajet_distance_km, hours_until_departure)

    print(f"   rideId: {ride_id}")
    print(f"   Heure départ: {departure_hour}h | Délai: {hours_until_departure:.1f}h")
    print(f"   Distance trajet: {trajet_distance_km}km | Rayon drivers: {max_km}km")
    print(f"   Géoloc passager: {'✅ disponible' if geo_available else '❌ absente'}")

    all_drivers        = drivers or []
    interaction_counts = interaction_counts or {}


    if not all_drivers:
        return []

    passenger_key = f"P{str(passenger_id).lstrip('P')}"

    if passenger_key not in recommender.user_id_map:
        print("   Mode: cold-start (nouveau passager) → filtrage préférences")
        return cold_start_by_preferences(
            all_drivers, preferences, departure_hour,
            hours_until_departure, start_lat, start_lng,
            max_km, top_n
        )

    lightfm_scores_map = recommender.predict_for_passenger(passenger_key)

    global _optimized_weights

    if _optimized_weights is not None:
        w = _optimized_weights
        print(f"   Poids: optimisés par régression bornée")
    elif geo_available:
        w = DEFAULT_WEIGHTS_GEO
        print(f"   Poids: hardcodés géoloc dispo | "
              f"LFM={w[0]} Pref={w[1]} Dist={w[2]} Work={w[3]} Rating={w[4]} "
              f"| ({len(_scores_history)}/10 feedbacks)")
    else:
        w = DEFAULT_WEIGHTS_NO_GEO
        print(f"   Poids: hardcodés géoloc absente | "
              f"LFM={w[0]} Pref={w[1]} Dist={w[2]} Work={w[3]} Rating={w[4]} "
              f"| ({len(_scores_history)}/10 feedbacks)")

    w_lfm, w_pref, w_dist, w_work, w_rating = w

    scored_drivers = []
    for driver in all_drivers:
        driver_id = f"D{driver['id']}"

        if geo_available and driver.get("latitude") and driver.get("longitude"):
            try:
                dist_km = haversine(
                    driver["latitude"], driver["longitude"],
                    start_lat, start_lng
                )
                driver["distance_km"] = round(dist_km, 1)
            except Exception:
                dist_km = None
        else:
            dist_km = None

        if dist_km is not None and dist_km > max_km:
            continue

        dist_score    = score_distance(dist_km, hours_until_departure) if dist_km is not None else 0.5
        lightfm_score = lightfm_scores_map.get(driver_id, 0.0)
        pref_score    = calculate_match_score(driver, preferences)
        work_score    = work_hour_match(driver, departure_hour)
        avg_rating    = driver.get("avgRating") or 4.0
        rating_score  = (avg_rating - 1) / 4

        if lightfm_scores_map and max(lightfm_scores_map.values()) > 0:
            final_score = (
                w_lfm    * lightfm_score +
                w_pref   * pref_score    +
                w_dist   * dist_score    +
                w_work   * work_score    +
                w_rating * rating_score
            )
        else:
            if geo_available:
                final_score = (
                    0.40 * pref_score   +
                    0.35 * dist_score   +
                    0.15 * work_score   +
                    0.10 * rating_score
                )
            else:
                final_score = (
                    0.55 * pref_score   +
                    0.30 * work_score   +
                    0.15 * rating_score
                )

        print(f"   D{driver['id']:3d} | "
              f"LFM={lightfm_score:.3f} | Pref={pref_score:.3f} | "
              f"Dist={'N/A' if dist_km is None else f'{dist_score:.3f}'} | "
              f"Work={work_score:.1f} | Rating={rating_score:.3f} | "
              f"→ Final={final_score:.4f}")

        save_recommendation_log(ride_id, driver_id, {
            "lightfm": lightfm_score,
            "pref":    pref_score,
            "dist":    dist_score,
            "work":    work_score,
            "rating":  rating_score,
        })

        nb_trajets_ensemble = interaction_counts.get(str(driver["id"]), 0)
        if   nb_trajets_ensemble >= 5: final_score *= 0.80
        elif nb_trajets_ensemble >= 3: final_score *= 0.90

        driver["final_score"] = round(final_score, 4)
        driver["work_match"]  = work_score == 1.0
        driver["dist_score"]  = round(dist_score, 3) if dist_km is not None else None
        scored_drivers.append(driver)

    scored_drivers.sort(key=lambda d: d.get("final_score", 0), reverse=True)
    for driver in scored_drivers:
        driver.pop("final_score", None)

    print(f"✅ {len(scored_drivers)} drivers dans le rayon | "
          f"Top {min(top_n, len(scored_drivers))} retournés")
    return scored_drivers[:top_n]